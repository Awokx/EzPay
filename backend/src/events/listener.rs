use std::{env, time::Duration};

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use super::processor::{
    advance_empty_poll, load_cursor, process_rpc_event, reset_cursor, ContractEvent,
};

const DEFAULT_RPC_URL: &str = "https://soroban-testnet.stellar.org";

#[derive(Debug, Clone)]
pub struct EventListenerConfig {
    pub(super) rpc_url: String,
    pub(super) contract_id: String,
    pub(super) start_ledger: Option<u32>,
    pub(super) poll_interval: Duration,
}

impl EventListenerConfig {
    pub fn from_env() -> Result<Option<Self>> {
        let Ok(contract_id) = env::var("STELLAR_CONTRACT_ID") else {
            return Ok(None);
        };
        if contract_id.trim().is_empty() {
            return Ok(None);
        }
        let start_ledger = env::var("STELLAR_EVENT_START_LEDGER")
            .ok()
            .map(|value| value.parse::<u32>())
            .transpose()
            .context("STELLAR_EVENT_START_LEDGER must be a ledger number")?;
        let poll_seconds = env::var("STELLAR_EVENT_POLL_INTERVAL_SECS")
            .ok()
            .map(|value| value.parse::<u64>())
            .transpose()
            .context("STELLAR_EVENT_POLL_INTERVAL_SECS must be an integer")?
            .unwrap_or(3)
            .max(1);

        Ok(Some(Self {
            rpc_url: env::var("STELLAR_RPC_URL").unwrap_or_else(|_| DEFAULT_RPC_URL.to_string()),
            contract_id,
            start_ledger,
            poll_interval: Duration::from_secs(poll_seconds),
        }))
    }
}

#[derive(Serialize)]
struct RpcRequest<'a> {
    jsonrpc: &'static str,
    id: u64,
    method: &'static str,
    params: RpcParams<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RpcParams<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    start_ledger: Option<u32>,
    filters: [RpcFilter<'a>; 1],
    pagination: RpcPagination<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RpcFilter<'a> {
    #[serde(rename = "type")]
    event_type: &'static str,
    contract_ids: [&'a str; 1],
}

#[derive(Serialize)]
struct RpcPagination<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<&'a str>,
    limit: u32,
}

#[derive(Deserialize)]
struct RpcResponse {
    result: Option<RpcResult>,
    error: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RpcResult {
    pub(super) events: Vec<ContractEvent>,
    pub(super) latest_ledger: u32,
    pub(super) oldest_ledger: u32,
}

pub async fn run(pool: PgPool, config: EventListenerConfig) -> Result<()> {
    let client = Client::builder().timeout(Duration::from_secs(30)).build()?;
    let saved_cursor = load_cursor(&pool, &config.contract_id).await?;
    let mut cursor = saved_cursor.as_ref().and_then(|saved| saved.cursor.clone());
    let mut next_start_ledger = if let Some(saved) = saved_cursor {
        u32::try_from(saved.cursor_ledger).ok()
    } else {
        config.start_ledger
    };
    tracing::info!(contract_id = %config.contract_id, rpc_url = %config.rpc_url, "Starting Soroban contract event polling");

    loop {
        if next_start_ledger.is_none() {
            match fetch_latest_ledger(&client, &config.rpc_url).await {
                Ok(latest_ledger) => next_start_ledger = Some(latest_ledger),
                Err(error) => {
                    tracing::warn!(%error, "Unable to initialize Soroban event cursor; retrying");
                    tokio::time::sleep(config.poll_interval).await;
                    continue;
                }
            }
        }
        match fetch_events(&client, &config, cursor.as_deref(), next_start_ledger).await {
            Ok(result) => {
                if let Some(cursor_value) = cursor.as_deref() {
                    if result.oldest_ledger > 0 {
                        tracing::debug!(cursor = %cursor_value, oldest_ledger = result.oldest_ledger, "Resuming Soroban event stream");
                    }
                }
                let event_count = result.events.len();
                let mut batch_processed = true;
                for event in result.events {
                    if let Err(error) = process_rpc_event(&pool, &config.contract_id, &event).await {
                        tracing::error!(event_id = %event.id, %error, "Contract event processing failed; will retry");
                        batch_processed = false;
                        break;
                    }
                    cursor = Some(event.cursor().to_string());
                    next_start_ledger = u32::try_from(event.ledger).ok();
                    let lag = i64::from(result.latest_ledger).saturating_sub(event.ledger);
                    tracing::info!(event_ledger = event.ledger, latest_ledger = result.latest_ledger, lag_ledgers = lag, "Contract event synchronized");
                }
                if batch_processed && event_count < 100 {
                    let lag = next_start_ledger
                        .map(|ledger| result.latest_ledger.saturating_sub(ledger))
                        .unwrap_or_default();
                    if let Err(error) = advance_empty_poll(&pool, &config.contract_id, result.latest_ledger).await {
                        tracing::error!(%error, "Failed to persist empty-poll ledger checkpoint");
                    } else {
                        next_start_ledger = Some(result.latest_ledger);
                    }
                    if event_count == 0 {
                        tracing::debug!(latest_ledger = result.latest_ledger, lag_ledgers = lag, "No new contract events");
                    }
                }
            }
            Err(error) => {
                tracing::warn!(%error, "Soroban event RPC request failed; reconnecting");
                if let (Ok(health), Some(start_ledger)) = (
                    fetch_health(&client, &config.rpc_url).await,
                    next_start_ledger,
                ) {
                    if start_ledger < health.oldest_ledger {
                        tracing::error!(
                            requested_start_ledger = start_ledger,
                            oldest_available_ledger = health.oldest_ledger,
                            "Soroban RPC retention window has passed; events in the gap cannot be replayed"
                        );
                        if let Err(reset_error) =
                            reset_cursor(&pool, &config.contract_id, health.oldest_ledger).await
                        {
                            tracing::error!(%reset_error, "Failed to reset expired event cursor");
                        } else {
                            cursor = None;
                            next_start_ledger = Some(health.oldest_ledger);
                        }
                    }
                }
            }
        }
        tokio::time::sleep(config.poll_interval).await;
    }
}

#[derive(Serialize)]
struct LatestLedgerRequest {
    jsonrpc: &'static str,
    id: u64,
    method: &'static str,
}

#[derive(Deserialize)]
struct LatestLedgerResponse {
    result: Option<LatestLedgerResult>,
    error: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LatestLedgerResult {
    sequence: u32,
}

#[derive(Serialize)]
struct HealthRequest {
    jsonrpc: &'static str,
    id: u64,
    method: &'static str,
}

#[derive(Deserialize)]
struct HealthResponse {
    result: Option<HealthResult>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResult {
    oldest_ledger: u32,
}

pub(super) struct RpcHealth {
    oldest_ledger: u32,
}

async fn fetch_health(client: &Client, rpc_url: &str) -> Result<RpcHealth> {
    let response: HealthResponse = client
        .post(rpc_url)
        .json(&HealthRequest {
            jsonrpc: "2.0",
            id: 3,
            method: "getHealth",
        })
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let result = response
        .result
        .ok_or_else(|| anyhow!("Soroban RPC health response omitted result"))?;
    Ok(RpcHealth {
        oldest_ledger: result.oldest_ledger,
    })
}

pub(super) async fn fetch_latest_ledger(client: &Client, rpc_url: &str) -> Result<u32> {
    let response: LatestLedgerResponse = client
        .post(rpc_url)
        .json(&LatestLedgerRequest {
            jsonrpc: "2.0",
            id: 2,
            method: "getLatestLedger",
        })
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if let Some(error) = response.error {
        return Err(anyhow!("Soroban RPC error: {error}"));
    }
    response
        .result
        .map(|result| result.sequence)
        .ok_or_else(|| anyhow!("Soroban RPC response omitted latest ledger"))
}

pub(super) async fn fetch_events(
    client: &Client,
    config: &EventListenerConfig,
    cursor: Option<&str>,
    start_ledger: Option<u32>,
) -> Result<RpcResult> {
    let request = RpcRequest {
        jsonrpc: "2.0",
        id: 1,
        method: "getEvents",
        params: RpcParams {
            start_ledger,
            filters: [RpcFilter {
                event_type: "contract",
                contract_ids: [&config.contract_id],
            }],
            pagination: RpcPagination { cursor, limit: 100 },
        },
    };
    let response: RpcResponse = client
        .post(&config.rpc_url)
        .json(&request)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if let Some(error) = response.error {
        return Err(anyhow!("Soroban RPC error: {error}"));
    }
    response.result.ok_or_else(|| anyhow!("Soroban RPC response omitted result"))
}
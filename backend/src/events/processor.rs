use anyhow::{anyhow, Result};
use sqlx::{PgPool, Postgres, Transaction};
use stellar_xdr::curr::{Int128Parts, Limits, ReadXdr, ScVal, WriteXdr};

use super::{
    merchant_events::{parse_merchant, parse_merchant_address},
    payment_events::{
        parse_cancelled_merchant, parse_payment_completed, parse_payment_request,
        parse_payment_request_id,
    },
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractEvent {
    pub id: String,
    pub paging_token: Option<String>,
    pub contract_id: Option<String>,
    pub ledger: i64,
    pub topic: Vec<String>,
    pub value: String,
}

impl ContractEvent {
    pub fn cursor(&self) -> &str {
        self.paging_token.as_deref().unwrap_or(&self.id)
    }
}

pub async fn process_event(pool: &PgPool, contract_id: &str, event: &ContractEvent) -> Result<()> {
    let mut transaction = pool.begin().await?;
    let inserted = sqlx::query(
        "INSERT INTO stellar_contract_events (event_id, contract_id, ledger, event_type, raw_event) \
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO NOTHING",
    )
    .bind(&event.id)
    .bind(contract_id)
    .bind(event.ledger)
    .bind(event.topic.first().cloned().unwrap_or_default())
    .bind(serde_json::to_value(event)?)
    .execute(&mut *transaction)
    .await?
    .rows_affected();

    if inserted == 1 {
        if let Err(error) = apply_event(&mut transaction, event).await {
            return Err(error);
        }
    }

    persist_cursor(&mut transaction, contract_id, event.cursor(), event.ledger).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn record_malformed_event(
    pool: &PgPool,
    contract_id: &str,
    event: &ContractEvent,
    error: &str,
) -> Result<()> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO stellar_contract_events (event_id, contract_id, ledger, event_type, raw_event, processing_error) \
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_id) DO UPDATE \
         SET processing_error = EXCLUDED.processing_error",
    )
    .bind(&event.id)
    .bind(contract_id)
    .bind(event.ledger)
    .bind(event.topic.first().cloned().unwrap_or_default())
    .bind(serde_json::to_value(event)?)
    .bind(error)
    .execute(&mut *transaction)
    .await?;
    persist_cursor(&mut transaction, contract_id, event.cursor(), event.ledger).await?;
    transaction.commit().await?;
    Ok(())
}

async fn persist_cursor(
    transaction: &mut Transaction<'_, Postgres>,
    contract_id: &str,
    cursor: &str,
    ledger: i64,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO stellar_event_cursors (stream_name, cursor, cursor_ledger) VALUES ($1, $2, $3) \
         ON CONFLICT (stream_name) DO UPDATE SET cursor = EXCLUDED.cursor, cursor_ledger = EXCLUDED.cursor_ledger, updated_at = NOW()",
    )
    .bind(contract_id)
    .bind(cursor)
    .bind(ledger)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn apply_event(
    transaction: &mut Transaction<'_, Postgres>,
    event: &ContractEvent,
) -> Result<()> {
    let Some(topic) = event.topic.first().and_then(|encoded| decode_symbol(encoded).ok()) else {
        return Err(anyhow!("event has no valid symbol topic"));
    };

    match topic.as_str() {
        "mrch_reg" | "mrch_upd" => {
            let merchant = parse_merchant(&event.value)?;
            sqlx::query(
                "INSERT INTO chain_merchants (address, name, wallet_address, payout_method, is_active, registered_at_ledger, updated_at_ledger) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (address) DO UPDATE SET \
                 name = EXCLUDED.name, wallet_address = EXCLUDED.wallet_address, payout_method = EXCLUDED.payout_method, \
                 is_active = EXCLUDED.is_active, updated_at_ledger = EXCLUDED.updated_at_ledger",
            )
            .bind(merchant.address)
            .bind(merchant.name)
            .bind(merchant.wallet_address)
            .bind(merchant.payout_method)
            .bind(merchant.is_active)
            .bind(merchant.registered_at_ledger)
            .bind(event.ledger)
            .execute(&mut **transaction)
            .await?;
        }
        "mrch_off" => {
            let Some(address_topic) = event.topic.get(1) else {
                return Err(anyhow!("merchant deactivation is missing address topic"));
            };
            let address = parse_merchant_address(address_topic)?;
            sqlx::query(
                "UPDATE chain_merchants SET is_active = FALSE, updated_at_ledger = $2 WHERE address = $1",
            )
            .bind(address)
            .bind(event.ledger)
            .execute(&mut **transaction)
            .await?;
        }
        "pay_req" => {
            let request = parse_payment_request(&event.value)?;
            sqlx::query(
                "INSERT INTO chain_payment_requests (id, merchant_address, token_address, amount, memo, status, created_at_ledger) \
                 VALUES ($1, $2, $3, $4::numeric, $5, CASE WHEN EXISTS (SELECT 1 FROM chain_payments WHERE request_id = $1) \
                 THEN 'completed' ELSE $6 END, $7) ON CONFLICT (id) DO UPDATE SET \
                 merchant_address = EXCLUDED.merchant_address, token_address = EXCLUDED.token_address, amount = EXCLUDED.amount, \
                 memo = EXCLUDED.memo, created_at_ledger = EXCLUDED.created_at_ledger, \
                 status = CASE WHEN chain_payment_requests.status = 'pending' AND EXISTS \
                 (SELECT 1 FROM chain_payments WHERE request_id = EXCLUDED.id) THEN 'completed' \
                 ELSE chain_payment_requests.status END",
            )
            .bind(request.id)
            .bind(request.merchant_address)
            .bind(request.token_address)
            .bind(request.amount.to_string())
            .bind(request.memo)
            .bind(request.status)
            .bind(request.created_at_ledger)
            .execute(&mut **transaction)
            .await?;
        }
        "pay_done" => {
            let id_topic = event.topic.get(1).ok_or_else(|| anyhow!("payment completion is missing request id"))?;
            let payer_topic = event.topic.get(2).ok_or_else(|| anyhow!("payment completion is missing payer"))?;
            let payment = parse_payment_completed(id_topic, payer_topic, &event.value)?;
            let amount = payment
                .net_amount
                .checked_add(payment.fee_amount)
                .ok_or_else(|| anyhow!("payment amount overflow"))?;
            sqlx::query(
                "INSERT INTO chain_payments (event_id, request_id, payer_address, token_address, amount, net_amount, fee_amount, ledger) \
                 VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric, $7::numeric, $8) ON CONFLICT (event_id) DO NOTHING",
            )
            .bind(&event.id)
            .bind(&payment.id)
            .bind(&payment.payer_address)
            .bind(&payment.token_address)
            .bind(amount.to_string())
            .bind(payment.net_amount.to_string())
            .bind(payment.fee_amount.to_string())
            .bind(event.ledger)
            .execute(&mut **transaction)
            .await?;
            sqlx::query(
                "UPDATE chain_payment_requests SET status = 'completed', paid_by = $2, net_amount = $3::numeric, \
                 fee_amount = $4::numeric, token_address = $5, settled_at_ledger = $6 WHERE id = $1",
            )
            .bind(payment.id)
            .bind(payment.payer_address)
            .bind(payment.net_amount.to_string())
            .bind(payment.fee_amount.to_string())
            .bind(payment.token_address)
            .bind(event.ledger)
            .execute(&mut **transaction)
            .await?;
        }
        "pay_cncl" => {
            let id_topic = event.topic.get(1).ok_or_else(|| anyhow!("payment cancellation is missing request id"))?;
            let merchant = parse_cancelled_merchant(&event.value)?;
            let id = parse_payment_request_id(id_topic)?;
            sqlx::query(
                "UPDATE chain_payment_requests SET status = 'cancelled', settled_at_ledger = $2 \
                 WHERE id = $1 AND merchant_address = $3",
            )
            .bind(id)
            .bind(event.ledger)
            .bind(merchant)
            .execute(&mut **transaction)
            .await?;
        }
        _ => tracing::debug!(event_type = %topic, "Ignoring unrelated contract event"),
    }
    Ok(())
}

fn decode_symbol(encoded: &str) -> Result<String> {
    let value = ScVal::from_xdr_base64(encoded, Limits::none())?;
    match value {
        ScVal::Symbol(symbol) => Ok(symbol.to_string()),
        _ => Err(anyhow!("first event topic is not a symbol")),
    }
}

pub(super) fn fields(value: &ScVal) -> Result<&[ScVal]> {
    match value {
        ScVal::Vec(Some(values)) => Ok(values.as_slice()),
        _ => Err(anyhow!("event value is not a Soroban struct/tuple")),
    }
}

pub(super) fn decode_address(value: &ScVal) -> Result<String> {
    match value {
        ScVal::Address(_) => Ok(value.to_xdr_base64(Limits::none())?),
        _ => Err(anyhow!("event value is not an address")),
    }
}

pub(super) fn decode_string(value: &ScVal) -> Result<String> {
    match value {
        ScVal::String(value) => Ok(value.to_string()),
        _ => Err(anyhow!("event value is not a string")),
    }
}

pub(super) fn decode_u32(value: &ScVal) -> Result<u32> {
    match value {
        ScVal::U32(value) => Ok(*value),
        _ => Err(anyhow!("event value is not a u32")),
    }
}

pub(super) fn decode_payout_method(value: &ScVal) -> Result<&'static str> {
    let variant = match value {
        ScVal::U32(variant) => Some(*variant),
        ScVal::Vec(Some(values)) => values.iter().find_map(|field| match field {
            ScVal::U32(variant) => Some(*variant),
            _ => None,
        }),
        _ => None,
    };
    match variant {
        Some(0) => Ok("wallet"),
        Some(1) => Ok("bank_account"),
        _ => Err(anyhow!("merchant payout method has an unknown XDR variant")),
    }
}

pub(super) fn decode_i128(value: &ScVal) -> Result<i128> {
    match value {
        ScVal::I128(Int128Parts { hi, lo }) => Ok((i128::from(*hi) << 64) | i128::from(*lo)),
        _ => Err(anyhow!("event value is not an i128")),
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct EventCursor {
    pub cursor: Option<String>,
    pub cursor_ledger: i64,
}

pub async fn load_cursor(pool: &PgPool, contract_id: &str) -> Result<Option<EventCursor>> {
    Ok(sqlx::query_as(
        "SELECT cursor, cursor_ledger FROM stellar_event_cursors WHERE stream_name = $1",
    )
    .bind(contract_id)
    .fetch_optional(pool)
    .await?)
}

pub async fn advance_empty_poll(pool: &PgPool, contract_id: &str, latest_ledger: u32) -> Result<()> {
    sqlx::query(
        "INSERT INTO stellar_event_cursors (stream_name, cursor, cursor_ledger) VALUES ($1, NULL, $2) \
         ON CONFLICT (stream_name) DO UPDATE SET cursor_ledger = EXCLUDED.cursor_ledger, updated_at = NOW()",
    )
    .bind(contract_id)
    .bind(i64::from(latest_ledger))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn reset_cursor(pool: &PgPool, contract_id: &str, start_ledger: u32) -> Result<()> {
    sqlx::query(
        "INSERT INTO stellar_event_cursors (stream_name, cursor, cursor_ledger) VALUES ($1, NULL, $2) \
         ON CONFLICT (stream_name) DO UPDATE SET cursor = NULL, cursor_ledger = EXCLUDED.cursor_ledger, updated_at = NOW()",
    )
    .bind(contract_id)
    .bind(i64::from(start_ledger))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn process_rpc_event(pool: &PgPool, contract_id: &str, event: &ContractEvent) -> Result<()> {
    match process_event(pool, contract_id, event).await {
        Ok(()) => Ok(()),
        Err(error) if error.downcast_ref::<sqlx::Error>().is_none() => {
            tracing::error!(event_id = %event.id, %error, "Malformed Stellar contract event; advancing cursor");
            record_malformed_event(pool, contract_id, event, &error.to_string()).await
        }
        Err(error) => Err(error),
    }
}
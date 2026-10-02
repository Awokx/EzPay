use stellar_xdr::curr::{Int128Parts, ScVal};

use super::{
    payment_events::parse_payment_request,
    processor::{decode_i128, decode_payout_method},
};

#[test]
fn decode_i128_handles_signed_values() {
    assert_eq!(decode_i128(&ScVal::I128(Int128Parts { hi: 0, lo: 42 })).unwrap(), 42);
    assert_eq!(decode_i128(&ScVal::I128(Int128Parts { hi: -1, lo: u64::MAX })).unwrap(), -1);
}

#[test]
fn payment_request_parser_rejects_malformed_xdr() {
    assert!(parse_payment_request("not-base64-xdr").is_err());
}

#[test]
fn payout_method_variants_map_to_database_values() {
    assert_eq!(decode_payout_method(&ScVal::U32(0)).unwrap(), "wallet");
    assert_eq!(decode_payout_method(&ScVal::U32(1)).unwrap(), "bank_account");
}

#[tokio::test]
#[ignore = "requires a reachable Soroban RPC testnet and STELLAR_TEST_CONTRACT_ID"]
async fn testnet_rpc_accepts_contract_event_query() {
    let rpc_url = std::env::var("STELLAR_RPC_URL")
        .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".to_string());
    let contract_id = std::env::var("STELLAR_TEST_CONTRACT_ID")
        .expect("set STELLAR_TEST_CONTRACT_ID to a deployed Soroban contract");
    let client = reqwest::Client::new();
    let start_ledger = super::listener::fetch_latest_ledger(&client, &rpc_url)
        .await
        .unwrap();
    let config = super::listener::EventListenerConfig {
        rpc_url,
        contract_id,
        start_ledger: Some(start_ledger),
        poll_interval: std::time::Duration::from_secs(1),
    };

    let result = super::listener::fetch_events(&client, &config, None, Some(start_ledger))
        .await
        .unwrap();
    assert!(result.latest_ledger >= start_ledger);
}
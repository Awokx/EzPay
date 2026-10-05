use anyhow::{anyhow, Result};
use stellar_xdr::curr::{Limits, ReadXdr, ScVal};

use super::processor::{decode_address, decode_i128, decode_string, decode_u32, fields};

#[derive(Debug, Clone)]
pub struct PaymentRequestEvent {
    pub id: String,
    pub merchant_address: String,
    pub token_address: String,
    pub amount: i128,
    pub memo: String,
    pub status: &'static str,
    pub created_at_ledger: i64,
}

#[derive(Debug, Clone)]
pub struct PaymentCompletedEvent {
    pub id: String,
    pub payer_address: String,
    pub net_amount: i128,
    pub fee_amount: i128,
    pub token_address: String,
}

pub fn parse_payment_request(data: &str) -> Result<PaymentRequestEvent> {
    let value = ScVal::from_xdr_base64(data, Limits::none())?;
    let values = fields(&value)?;
    if values.len() != 10 {
        return Err(anyhow!("payment request has {} fields, expected 10", values.len()));
    }

    Ok(PaymentRequestEvent {
        id: decode_bytes(values[0])?,
        merchant_address: decode_address(values[1])?,
        token_address: decode_address(values[2])?,
        amount: decode_i128(values[3])?,
        memo: decode_string(values[4])?,
        status: "pending",
        created_at_ledger: i64::from(decode_u32(values[6])?),
    })
}

pub fn parse_payment_completed(
    id_topic: &str,
    payer_topic: &str,
    data: &str,
) -> Result<PaymentCompletedEvent> {
    let id = decode_bytes(&ScVal::from_xdr_base64(id_topic, Limits::none())?)?;
    let payer_address = decode_address(&ScVal::from_xdr_base64(payer_topic, Limits::none())?)?;
    let value = ScVal::from_xdr_base64(data, Limits::none())?;
    let values = fields(&value)?;
    if values.len() != 3 {
        return Err(anyhow!("payment completion has {} fields, expected 3", values.len()));
    }

    Ok(PaymentCompletedEvent {
        id,
        payer_address,
        net_amount: decode_i128(values[0])?,
        fee_amount: decode_i128(values[1])?,
        token_address: decode_address(values[2])?,
    })
}

pub fn parse_payment_request_id(topic: &str) -> Result<String> {
    decode_bytes(&ScVal::from_xdr_base64(topic, Limits::none())?)
}

pub fn parse_cancelled_merchant(data: &str) -> Result<String> {
    decode_address(&ScVal::from_xdr_base64(data, Limits::none())?)
}

fn decode_bytes(value: &ScVal) -> Result<String> {
    let ScVal::Bytes(bytes) = value else {
        return Err(anyhow!("event identifier is not a byte string"));
    };
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}
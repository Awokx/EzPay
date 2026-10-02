use anyhow::{anyhow, Result};
use stellar_xdr::curr::{Limits, ReadXdr, ScVal};

use super::processor::{decode_address, decode_payout_method, decode_string, decode_u32, fields};

#[derive(Debug, Clone)]
pub struct MerchantEvent {
    pub address: String,
    pub name: String,
    pub wallet_address: String,
    pub payout_method: String,
    pub is_active: bool,
    pub registered_at_ledger: i64,
}

pub fn parse_merchant(data: &str) -> Result<MerchantEvent> {
    let value = ScVal::from_xdr_base64(data, Limits::none())?;
    let values = fields(&value)?;
    if values.len() != 6 {
        return Err(anyhow!("merchant event has {} fields, expected 6", values.len()));
    }
    let payout_method = decode_payout_method(values[3])?.to_string();

    Ok(MerchantEvent {
        address: decode_address(values[0])?,
        name: decode_string(values[1])?,
        wallet_address: decode_address(values[2])?,
        payout_method,
        is_active: match values[4] {
            ScVal::Bool(active) => *active,
            _ => return Err(anyhow!("merchant active flag is not a boolean")),
        },
        registered_at_ledger: i64::from(decode_u32(values[5])?),
    })
}

pub fn parse_merchant_address(topic: &str) -> Result<String> {
    let value = ScVal::from_xdr_base64(topic, Limits::none())?;
    decode_address(&value)
}

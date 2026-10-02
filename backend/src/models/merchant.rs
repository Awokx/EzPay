use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Merchant {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub wallet_address: String,
    pub payout_method: PayoutMethod,
    pub bank_account: Option<String>,
    pub bank_routing_number: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "payout_method", rename_all = "lowercase")]
pub enum PayoutMethod {
    Wallet,
    Bank,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMerchant {
    pub name: String,
    pub email: String,
    pub password: String,
    pub wallet_address: String,
    pub payout_method: PayoutMethod,
    pub bank_account: Option<String>,
    pub bank_routing_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateMerchant {
    pub name: Option<String>,
    pub payout_method: Option<PayoutMethod>,
    pub bank_account: Option<String>,
    pub bank_routing_number: Option<String>,
}

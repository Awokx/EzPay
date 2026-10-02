// Database configuration and connection pool
use sqlx::postgres::{PgPool, PgPoolOptions};
use crate::config::DatabaseConfig;

pub async fn create_pool(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .connect(&config.url)
        .await
}

#[cfg(test)]
pub mod test_utils {
    use super::*;

    pub async fn create_test_pool() -> Result<PgPool, sqlx::Error> {
        let database_url = env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/ezpay_test".to_string());

        PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
    }
}

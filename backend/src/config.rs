use anyhow::{bail, Context, Result};
use std::{env, str::FromStr};

pub struct Config {
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub stellar: StellarConfig,
    pub jwt_secret: Option<String>,
    pub anchor_api_key: Option<String>,
    pub rate_limit: RateLimitConfig,
}

pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

pub struct StellarConfig {
    pub network: String,
    pub horizon_url: String,
    pub network_passphrase: String,
}

pub struct RateLimitConfig {
    pub max_requests: u32,
    pub window_seconds: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .context("DATABASE_URL is required; set it to a PostgreSQL connection URL")?;
        if !(database_url.starts_with("postgres://") || database_url.starts_with("postgresql://")) {
            bail!("DATABASE_URL must use the postgres:// or postgresql:// scheme");
        }

        let network = env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".to_string());
        let (default_horizon_url, default_passphrase) = match network.as_str() {
            "testnet" => (
                "https://horizon-testnet.stellar.org",
                "Test SDF Network ; September 2015",
            ),
            "mainnet" => (
                "https://horizon.stellar.org",
                "Public Global Stellar Network ; September 2015",
            ),
            _ => bail!("STELLAR_NETWORK must be either 'testnet' or 'mainnet'"),
        };

        let horizon_url = env::var("STELLAR_HORIZON_URL")
            .unwrap_or_else(|_| default_horizon_url.to_string());
        if !(horizon_url.starts_with("http://") || horizon_url.starts_with("https://")) {
            bail!("STELLAR_HORIZON_URL must be an http:// or https:// URL");
        }

        let jwt_secret = optional_env("JWT_SECRET");
        if jwt_secret.as_ref().is_some_and(|secret| secret.len() < 32) {
            bail!("JWT_SECRET must contain at least 32 characters when set");
        }

        Ok(Config {
            database: DatabaseConfig {
                url: database_url,
                max_connections: parse_or_default("DB_MAX_CONNECTIONS", 5)?,
            },
            server: ServerConfig {
                host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: parse_or_default("PORT", 3001)?,
            },
            stellar: StellarConfig {
                network,
                horizon_url,
                network_passphrase: env::var("STELLAR_NETWORK_PASSPHRASE")
                    .unwrap_or_else(|_| default_passphrase.to_string()),
            },
            jwt_secret,
            anchor_api_key: optional_env("ANCHOR_API_KEY"),
            rate_limit: RateLimitConfig {
                max_requests: parse_or_default("RATE_LIMIT_MAX_REQUESTS", 100)?,
                window_seconds: parse_or_default("RATE_LIMIT_WINDOW_SECONDS", 60)?,
            },
        })
    }
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn parse_or_default<T>(name: &str, default: T) -> Result<T>
where
    T: FromStr,
    T::Err: std::fmt::Display,
{
    match optional_env(name) {
        Some(value) => value
            .parse()
            .with_context(|| format!("{name} must be a valid number")),
        None => Ok(default),
    }
}

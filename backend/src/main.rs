mod config;
mod models;
mod routes;
mod db;
mod middleware;
mod events;

use axum::Router;
use std::time::Duration;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "ezpay_backend=info,tower_http=info".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    let pool = db::create_pool(&config.database).await?;

    if let Some(event_config) = events::listener::EventListenerConfig::from_env()? {
        let event_pool = pool.clone();
        tokio::spawn(async move {
            loop {
                if let Err(error) = events::listener::run(event_pool.clone(), event_config.clone()).await {
                    tracing::error!(%error, "Stellar event listener stopped; restarting");
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            }
        });
    } else {
        tracing::info!("Stellar event listener disabled: STELLAR_CONTRACT_ID is not set");
    }

    let app = Router::new()
        .nest("/api", routes::merchant_routes().merge(routes::payment_routes()).merge(routes::health_routes_with_db(pool.clone())))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
                .max_age(Duration::from_secs(60 * 60)),
        )
        .layer(TraceLayer::new_for_http());

    let addr = (config.server.host.as_str(), config.server.port);
    tracing::info!(host = %config.server.host, port = config.server.port, "EzPay backend listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

mod config;
mod models;
mod routes;
mod db;
mod middleware;

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

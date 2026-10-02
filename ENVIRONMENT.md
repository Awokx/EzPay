# Environment Configuration

This guide covers the backend, frontend, and Soroban contract deployment settings. The checked-in `.env.example` files contain local/testnet examples only; copy them to `.env` and edit the local copies. Never commit `.env` files, private keys, JWT secrets, or provider credentials.

## Setup

1. Install the prerequisites in [DEVELOPMENT.md](DEVELOPMENT.md): Rust and Cargo, Node.js and npm, PostgreSQL, and (for deployment) the Stellar CLI and WASM build tools.
2. Copy the service examples: `cp backend/.env.example backend/.env`, `cp frontend/.env.example frontend/.env`, and, only when deploying, `cp smart-contract/.env.example smart-contract/.env`.
3. Set `DATABASE_URL` in `backend/.env` to a PostgreSQL database that exists, then apply the migration from the repository root: `psql "$DATABASE_URL" -f backend/migrations/001_initial.up.sql`.
4. Start the backend from `backend/` with `cargo run`; start the frontend from `frontend/` with `npm install && npm run dev`.
5. Contract deployment is optional for local app development. Configure its signer and network in `smart-contract/.env`, then run `./deploy.sh` from `smart-contract/`.

The root `docker-compose.yml` has its own development-only environment values; Compose does not automatically load the service `.env` files. Its PostgreSQL password is not suitable for production. For `docker compose up --build`, review and replace the values in that file first.

## Backend

| Variable | Required | Default / example | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/ezpay` | PostgreSQL connection URL. Startup reports an error if missing or not a `postgres://` / `postgresql://` URL. |
| `DB_MAX_CONNECTIONS` | No | `5` | Maximum SQLx database pool size; must be a valid number. |
| `HOST` | No | `0.0.0.0` | Backend bind address. |
| `PORT` | No | `3001` | Backend port; must be a valid port number. |
| `RUST_LOG` | No | `ezpay_backend=info,tower_http=info` | Rust tracing filter. |
| `STELLAR_NETWORK` | No | `testnet` | `testnet` or `mainnet`; selects the default Horizon URL and network passphrase. |
| `STELLAR_HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | Horizon HTTP(S) endpoint. Override when using a compatible provider. |
| `STELLAR_NETWORK_PASSPHRASE` | No | Testnet passphrase | Override only when using a network with a custom passphrase. Keep it consistent with the selected Stellar network. |
| `JWT_SECRET` | No | unset | Reserved for the planned JWT authentication. If set, startup requires at least 32 characters. JWT authentication is not implemented yet, so this value is not currently used. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Planned rate-limit threshold; must be a valid number. Rate limiting is not implemented yet, so this setting is not currently enforced. |
| `RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Planned rate-limit window in seconds; must be a valid number. Not currently enforced. |
| `ANCHOR_API_KEY` | No | unset | Optional credential placeholder for a future Anchor integration. No Anchor provider is currently called by the backend. Obtain credentials from the Anchor service you choose; do not expose this value to the frontend. |

Only `DATABASE_URL` is currently required by the backend. Use a strong, unique database password outside local development. The backend does not need a Stellar signing secret: wallet signing is intended to happen in the user's wallet.

## Frontend

All `NEXT_PUBLIC_*` values are public and may be embedded in browser JavaScript. Never place passwords, private keys, JWT secrets, or private API keys in them.

| Variable | Required | Default / example | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | Backend API base URL. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | `testnet` | `testnet` or `public` (Stellar mainnet). Invalid values cause a clear configuration error. |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | No | `https://horizon-testnet.stellar.org` | Stellar Horizon endpoint used by wallet/network configuration. Match it to the selected network. |
| `NEXT_PUBLIC_APP_NAME` | No | `EzPay` | Displayed application name. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application URL. |
| `NEXT_PUBLIC_ENABLE_WALLET_CONNECT` | No | `true` | Enables the wallet connection feature flag. |
| `NEXT_PUBLIC_ENABLE_QR_PAYMENTS` | No | `true` | Enables QR payment feature flag. |
| `NEXT_PUBLIC_ENABLE_PAYMENT_LINKS` | No | `true` | Enables payment link feature flag. |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | No | `false` | Enables analytics when set to `true`. |
| `NEXT_PUBLIC_ANALYTICS_ID` | No | empty | Public analytics identifier, if analytics is enabled. |

The frontend defaults to testnet. `NEXT_PUBLIC_STELLAR_NETWORK=public` switches the wallet signing passphrase to Stellar mainnet; also set the matching public Horizon endpoint. Next.js public values are generally embedded at build time, so set them before building a Docker image or production bundle.

## Smart Contract

| Variable | Required | Default / example | Description |
| --- | --- | --- | --- |
| `STELLAR_NETWORK` | For deployment | `testnet` | `testnet` or `mainnet`. The deploy script rejects other values. |
| `STELLAR_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint. The script uses a network default if omitted; use a trusted provider for production. |
| `STELLAR_NETWORK_PASSPHRASE` | No | Testnet passphrase | Network passphrase; defaults to the selected public network when omitted. |
| `SECRET_KEY` | Yes, for deployment | empty in example | Soroban CLI signer identity or secret used to deploy. The script exits before building if it is missing. Use a dedicated, funded testnet account for testing. |
| `CONTRACT_ID` | After deployment | empty | Deployed contract address. Record it securely for invocation and frontend/backend integration. |
| `ADMIN_ADDRESS` | For initialization | empty | Public Stellar address passed as the contract administrator when initializing. This is an address, not a secret key. |

For initialization, use the deployed `CONTRACT_ID`, `ADMIN_ADDRESS`, and a separate fee-recipient address with `soroban contract invoke` as shown in [smart-contract/README.md](smart-contract/README.md). Do not use a production admin key for testnet work.

## Docker

The backend container can receive its service configuration with `--env-file`. When the database is another container on a shared Docker network, use its service name rather than `localhost`:

```sh
docker build -t ezpay-backend ./backend
docker run --rm --network ezpay_default -p 3001:3001 \
  --env-file backend/.env \
  -e DATABASE_URL=postgresql://postgres:password@postgres:5432/ezpay \
  ezpay-backend
```

This command assumes the Compose network and `postgres` service exist. The shown database credentials are for local development only. Do not pass secrets on shared command lines in production; use your container platform's secret manager. Frontend `NEXT_PUBLIC_*` variables must be supplied at image build time to be embedded in browser code.

## Security

- Keep local `.env` files out of version control; commit only the `.env.example` templates. Rotate a credential immediately if it is accidentally exposed.
- Use different accounts, keys, database credentials, and provider API keys for testnet and mainnet. Never fund or deploy from a development signer on mainnet.
- Generate JWT secrets with a cryptographically secure random generator, for example `openssl rand -hex 32`; do not reuse passwords or commit the result. JWT support is not active until the backend authentication TODOs are implemented.
- Restrict API keys to the minimum required permissions and store them in a secret manager in deployed environments. Do not use `NEXT_PUBLIC_` for any secret.
- Use HTTPS for public API and provider endpoints, and restrict database access to the backend network. Replace the development PostgreSQL password in Docker Compose before any non-local deployment.
- Verify the network, RPC/Horizon endpoint, and passphrase together before submitting contract transactions. Test deployments and initialization on testnet first.
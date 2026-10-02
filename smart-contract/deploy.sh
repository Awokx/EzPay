#!/bin/bash

# EzPay Smart Contract Deployment Script
# This script deploys the EzPay Soroban contract to the Stellar network

set -e

# Load shell-compatible environment variables from the local deployment file.
if [ -f .env ]; then
    set -a
    . ./.env
    set +a
fi

NETWORK=${STELLAR_NETWORK:-testnet}
SECRET_KEY=${SECRET_KEY:-}
case "$NETWORK" in
    testnet)
        RPC_URL=${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}
        PASSPHRASE=${STELLAR_NETWORK_PASSPHRASE:-"Test SDF Network ; September 2015"}
        ;;
    mainnet)
        RPC_URL=${STELLAR_RPC_URL:-https://mainnet.sorobanrpc.com}
        PASSPHRASE=${STELLAR_NETWORK_PASSPHRASE:-"Public Global Stellar Network ; September 2015"}
        ;;
    *)
        echo "Error: STELLAR_NETWORK must be either 'testnet' or 'mainnet'." >&2
        exit 1
        ;;
esac

if [ -z "$SECRET_KEY" ]; then
    echo "Error: SECRET_KEY is required. Set it in smart-contract/.env or the environment." >&2
    exit 1
fi

echo "Deploying EzPay contract to $NETWORK..."
echo "RPC URL: $RPC_URL"

# Build the contract
echo "Building contract..."
cargo build --target wasm32-unknown-unknown --release

# Optimize the WASM
echo "Optimizing WASM..."
wasm-opt target/wasm32-unknown-unknown/release/ezpay.wasm \
    -O3 \
    --strip-debug \
    -o target/ezpay_optimized.wasm

# Deploy the contract
echo "Deploying contract..."
soroban contract deploy \
    --wasm target/ezpay_optimized.wasm \
    --source "$SECRET_KEY" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$PASSPHRASE"

echo "Contract deployed successfully!"
echo "Please save the contract ID for initialization."

CREATE TABLE chain_merchants (
    address TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    payout_method TEXT NOT NULL,
    is_active BOOLEAN NOT NULL,
    registered_at_ledger BIGINT NOT NULL,
    updated_at_ledger BIGINT NOT NULL
);

CREATE TABLE chain_payment_requests (
    id CHAR(64) PRIMARY KEY,
    merchant_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    amount NUMERIC(39, 0) NOT NULL,
    memo TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at_ledger BIGINT NOT NULL,
    settled_at_ledger BIGINT,
    paid_by TEXT,
    net_amount NUMERIC(39, 0),
    fee_amount NUMERIC(39, 0)
);

CREATE INDEX idx_chain_payment_requests_merchant ON chain_payment_requests(merchant_address);
CREATE INDEX idx_chain_payment_requests_status ON chain_payment_requests(status);

CREATE TABLE chain_payments (
    event_id TEXT PRIMARY KEY,
    request_id CHAR(64) NOT NULL,
    payer_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    amount NUMERIC(39, 0) NOT NULL,
    net_amount NUMERIC(39, 0) NOT NULL,
    fee_amount NUMERIC(39, 0) NOT NULL,
    ledger BIGINT NOT NULL
);

CREATE INDEX idx_chain_payments_request_id ON chain_payments(request_id);

CREATE TABLE stellar_event_cursors (
    stream_name TEXT PRIMARY KEY,
    cursor TEXT,
    cursor_ledger BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stellar_contract_events (
    event_id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    ledger BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    raw_event JSONB NOT NULL,
    processing_error TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stellar_contract_events_ledger ON stellar_contract_events(ledger);
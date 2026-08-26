-- 0001_init_ledger_core.sql
-- Foundation schema: tenants, users, accounts, immutable double-entry ledger,
-- and holds. This is the Week 1 / "First 48 Hours" slice of the domain model
-- from docs/architecture — everything financial correctness depends on.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
    tenant_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
    role        TEXT NOT NULL CHECK (role IN ('platform_operator', 'tenant_admin', 'finance_operator', 'viewer')),
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Accounts hold no balance column: available/held/pending balances are always
-- derived from immutable ledger_entries + active holds (see src/ledger).
-- This is a deliberate invariant (ADR-002): balances are a view, not a fact.
CREATE TABLE accounts (
    account_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
    currency    CHAR(3) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);

-- Immutable financial transaction header. Never UPDATE a posted row; a
-- correction is a new balanced transaction (typically a reversal).
CREATE TABLE ledger_transactions (
    transaction_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id),
    type            TEXT NOT NULL CHECK (type IN ('payment', 'hold_capture', 'reversal', 'payout', 'settlement')),
    status          TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted')),
    reference       TEXT,
    reverses_transaction_id UUID REFERENCES ledger_transactions(transaction_id),
    currency        CHAR(3) NOT NULL,
    posted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_transactions_tenant ON ledger_transactions(tenant_id);

-- Debit/credit facts. A transaction is balanced iff SUM(amount WHERE
-- direction='debit') = SUM(amount WHERE direction='credit') per transaction —
-- enforced in application code today (see src/ledger/postTransaction.ts) and
-- verified continuously by the reconciliation engine (Week 6).
CREATE TABLE ledger_entries (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES ledger_transactions(transaction_id),
    account_id      UUID NOT NULL REFERENCES accounts(account_id),
    direction       TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount          NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    currency        CHAR(3) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);

-- Reserved funds against an account. A hold cannot exceed available funds
-- (I4) — enforced with SELECT ... FOR UPDATE on the account in
-- src/ledger/createHold.ts, not by a Redis lock.
CREATE TABLE holds (
    hold_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES accounts(account_id),
    amount      NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'captured')),
    reference   TEXT,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_holds_account_status ON holds(account_id, status);

COMMIT;

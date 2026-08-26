# LedgerPulse

A multi-tenant financial infrastructure simulator that demonstrates
financial correctness under concurrency, retries, asynchronous delivery,
service failures, and duplicate events.

> **Core thesis:** Can a financial system preserve correct money state when
> requests are retried, transactions race, workers crash, events are
> duplicated, and external delivery fails?

This is a portfolio project, not a production payments system — see
[Scope](#scope) below.

## Status

Week 1 (Ledger Foundation) in progress. See [Roadmap](#roadmap).

- [x] PostgreSQL schema for tenants, accounts, immutable ledger, holds
- [x] Atomic, balanced double-entry transaction posting
- [x] Balance derivation (no stored balance column)
- [x] Hold creation with pessimistic locking (I4)
- [x] Invariant test: every posted transaction is balanced (I1)
- [x] Concurrency test: simultaneous holds cannot overspend (I4)
- [ ] Idempotency middleware
- [ ] Escrow state machine
- [ ] Transactional outbox + Kafka
- [ ] Webhooks + reconciliation engine
- [ ] Operational dashboard, observability, load testing

## Financial invariants

These are non-negotiable and enforced by the database, the application
layer, or both — not by convention:

| ID | Invariant |
|----|-----------|
| I1 | Every POSTED transaction has Σ debits = Σ credits |
| I2 | Posted ledger entries cannot be updated or deleted |
| I3 | Available balance cannot become negative |
| I4 | A hold cannot exceed the account's available funds |
| I5 | A settlement has exactly one financial effect |
| I6 | Reversals reference an existing posted transaction and create new balanced entries |
| I7 | Reusing an idempotency key with the same request returns the original result |
| I8 | Reusing an idempotency key with a different request body is rejected |
| I9 | Duplicate event delivery cannot produce duplicate financial effects |
| I10 | Every committed financial operation has an auditable history |
| I11 | Ledger state can be reconstructed from immutable entries |

## Architecture

Modular monolith with asynchronous workers, not a microservice fleet
(ADR-010, to be written). PostgreSQL owns financial correctness. Redis (planned) supports
non-authoritative coordination only. Kafka (planned) transports durable
domain events via the transactional outbox pattern.

```
API Gateway → Ledger Core → Escrow Core → Settlement/Payout →
  Outbox Publisher → Kafka → Webhook Worker / Reconciliation Worker
```

Architecture decisions are recorded in [docs/adr](docs/adr):
- [ADR-002: Immutable double-entry ledger model](docs/adr/0002-immutable-double-entry-ledger.md)
- [ADR-004: Concurrency control and isolation strategy](docs/adr/0004-concurrency-control.md)

## Getting started

Requires Node 20+ and PostgreSQL 16.

```bash
npm install

# Start Postgres (or point DATABASE_URL at an existing instance)
docker compose -f infra/docker/docker-compose.yml up -d

# Run migrations against dev and test databases
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ledgerpulse_dev npm run migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ledgerpulse_test npm run migrate

# Run the test suite (needs ledgerpulse_test to exist)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ledgerpulse_test npm test
```

## Scope

**Building:** multi-tenancy/RBAC, immutable double-entry ledger, holds,
idempotency, escrow/settlement lifecycle, reversals, transactional outbox,
Kafka consumers with retry/DLQ, webhook delivery, a reconciliation engine,
failure injection, an operational dashboard, and concurrency/invariant/load
testing.

**Explicitly not building in v1:** real banking integration, full KYC/AML,
production fraud ML, Kubernetes, a large microservice fleet, complex FX
market integration, a mobile app, or an elaborate frontend. A smaller
system with provable invariants beats a larger one with decorative
complexity.

## Roadmap

8-week plan — see [docs/architecture](docs/architecture) for the full
breakdown. Weeks 2–8: concurrency & correctness, idempotency & escrow,
settlement & payouts, outbox & Kafka, webhooks & reconciliation,
reliability & performance, productization & portfolio polish.

# ADR-002: Immutable double-entry ledger model

## Status
Accepted

## Context
LedgerPulse must preserve correct money state under retries, concurrency,
and partial failure. A mutable "balance" column on `accounts` is the
classic source of drift: two writers can race, a crash can leave a partial
update, and there is no way to reconstruct how a balance was reached.

## Decision
- `accounts` stores no balance. Every financial fact is a `ledger_entries`
  row (debit or credit) attached to an immutable `ledger_transactions`
  header.
- A transaction is valid only if its debits equal its credits (I1),
  validated in decimal-safe integer math before any row is written.
- Posted entries are never updated or deleted (I2). A correction is a new,
  separately balanced transaction — typically a reversal referencing the
  original via `reverses_transaction_id`.
- Balances (`posted`, `held`, `available`) are always derived at read time
  by summing `ledger_entries` and active `holds` (see `src/ledger/getBalance.ts`).

## Consequences
- Balance reads cost a `SUM` query instead of a column read. Acceptable at
  this scale; a materialized/cached balance can be added later as a
  read-model without changing the source of truth.
- Every historical state is reconstructable from `ledger_entries` alone
  (I11), which is what makes the reconciliation engine (Week 6) possible.
- Reversals must be modeled explicitly rather than "undone" — this is a
  deliberate constraint, not an oversight.

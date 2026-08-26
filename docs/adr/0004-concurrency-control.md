# ADR-004: Concurrency control and isolation strategy

## Status
Accepted

## Context
Two requests can race against the same account (e.g. two holds, two
payouts). Redis-based locking is tempting for speed but is not the
authoritative store for money — a lock that isn't backed by the database
that owns the data it's protecting cannot be trusted to prevent
double-spend across crashes, retries, or multiple app instances.

## Decision
- PostgreSQL row locks (`SELECT ... FOR UPDATE`) on the `accounts` row are
  the authoritative concurrency mechanism for balance-affecting writes.
- When an operation locks more than one account (e.g. a transfer),
  accounts are locked in a stable sorted order to make the lock acquisition
  deadlock-free (`src/ledger/postTransaction.ts::lockAccountsInOrder`).
- Default isolation is `READ COMMITTED` plus explicit row locks; `SERIALIZABLE`
  is reserved for operations where FOR UPDATE alone isn't sufficient, and
  its retry behavior will be measured before relying on it (Week 2).
- Redis may still be used for non-authoritative concerns (rate limiting,
  response caching for idempotency reads) — never for the lock that
  prevents overspend.

## Consequences
- Verified in `test/concurrency.test.ts`: two simultaneous holds that would
  together exceed available funds are serialized by the account row lock,
  and exactly one succeeds.
- Higher lock contention on hot accounts than an optimistic scheme; this is
  the deliberate trade-off for provable correctness over raw throughput
  (Section 22, Engineering Rulebook).

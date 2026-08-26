# Architecture

This directory tracks architecture notes as the system grows past what
fits in the top-level README. For now, the authoritative plan is:

- The 8-week execution plan and full domain model in the top-level
  [README](../../README.md#roadmap) and [ADRs](../adr/).
- Decisions get an ADR under [docs/adr](../adr) before they get code —
  see ADR-002 and ADR-004 for the format.

Planned additions as later weeks land: sequence diagrams for the outbox →
Kafka → webhook flow, the escrow state machine, and the reconciliation
engine's comparison logic.

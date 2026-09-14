# Canonical data dictionary

DEV-001 deliverables:

- [Canonical model v0.1](canonical-model.md): types, entity fields, relationships, units, timestamps, provenance and calculation invariants.
- [Product glossary](glossary.md): consistent plain-language meanings.
- [First-slice PRD](../product/first-slice-prd.md): screen behavior and acceptance criteria.
- [Manual acceptance matrix](../../tests/e2e/plans/dev-001-acceptance.md): document review scenarios.

The original broad canonical design remains a specification and does not imply full roadmap delivery. Executable strict contracts now live in packages/contracts/src for the implemented account, goals, holdings, privacy, research, library, learning, feedback and planning workflows; the additive migration ledger defines their stored records; applied migrations and later unverified additions are distinguished in development/status. Current implementation/evidence is in docs/development/status.md. The policy/threat design is documented in [threat model](../product/threat-model.md); the remaining reusable event/edge/lot/profile/result contracts are now authored under [DOMAIN-CONTRACTS-002](../product/domain-contracts.md). Their real-data consumers and valuation remain separately tracked.

The bounded virtual journey now has runtime contracts in packages/contracts/src/journey.ts. See [slice decisions](../product/educational-slice-policy.md) for differences from the full canonical design (synthetic IDs, uniform portfolio allocation and minor-unit rounding). DEV-003 now covers its initial reusable schema categories; it does not implement all proposed canonical runtime consumers.

TEAM-002 adds [exact goal allocations](../product/goal-allocations.md), [recovery lifecycle](../product/account-recovery.md), [immutable record reports](../product/record-reports.md) and [source security identities](../product/security-identities.md). Their runtime schemas, timestamps, ownership, versions and exact-unit rules are documented in those implementation specifications; they do not introduce market valuations or trade recommendations.

[Individual record-report deletion](../product/report-deletion.md) adds migration021: account-owned request-ID/deletion-time tombstones and one bounded request counter per account. Deleted financial snapshots and issued bodies are removed; only metadata survives until account deletion.

Manual acceptance: trace each implemented value to its runtime schema, confirm scale/meaning and timestamp identity, and flag proposed canonical entities without falsely reporting them as delivered. Document review does not require test execution.

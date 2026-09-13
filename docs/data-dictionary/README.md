# Canonical data dictionary

DEV-001 deliverables:

- [Canonical model v0.1](canonical-model.md): types, entity fields, relationships, units, timestamps, provenance and calculation invariants.
- [Product glossary](glossary.md): consistent plain-language meanings.
- [First-slice PRD](../product/first-slice-prd.md): screen behavior and acceptance criteria.
- [Manual acceptance matrix](../../tests/e2e/plans/dev-001-acceptance.md): document review scenarios.

The original broad canonical design remains a specification and does not imply full roadmap delivery. Executable strict contracts now live in packages/contracts/src for the implemented account, goals, holdings, privacy, research, library, learning, feedback and planning workflows; migrations001–021 define their stored records. Current implementation/evidence is in docs/development/status.md. Broader policy, event and valuation acceptance remains tracked under DEV-002–004.

The bounded virtual journey now has runtime contracts in packages/contracts/src/journey.ts. See [slice decisions](../product/educational-slice-policy.md) for differences from the full canonical design (synthetic IDs, uniform portfolio allocation and minor-unit rounding). Full canonical schemas remain DEV-003.

TEAM-002 adds [exact goal allocations](../product/goal-allocations.md), [recovery lifecycle](../product/account-recovery.md), [immutable record reports](../product/record-reports.md) and [source security identities](../product/security-identities.md). Their runtime schemas, timestamps, ownership, versions and exact-unit rules are documented in those implementation specifications; they do not introduce market valuations or trade recommendations.

[Individual record-report deletion](../product/report-deletion.md) adds migration021: account-owned request-ID/deletion-time tombstones and one bounded request counter per account. Deleted financial snapshots and issued bodies are removed; only metadata survives until account deletion.

# DOMAIN-CONTRACTS-002 handoff

Implementation is authored in the main working tree at local HEAD `6f2b50821d68b76bd6356efce7a2db258c643fee`. It is awaiting user validation and a gated commit. No dependency installation, formatting, checks, tests, builds, browser automation, service changes, provider calls, migrations or commits were run for this follow-up. Existing unrelated pending integration is preserved.

Earlier feature work implemented contracts for actual accounts, aggregate holdings, goals, source records, reports and their workflows. It left generic event/edge, acquisition-lot, financial-profile and educational result categories absent because those features did not consume them. DOMAIN-CONTRACTS-002 now supplies those reusable categories. That closes the initial DEV-003 schema/fixture authoring gap; it does not complete the runtime event, lot, profile or policy features.

## Manifest and concrete corrections

This follow-up owns exactly four files:

- `packages/contracts/src/domain-records.ts`: strict reusable records and joins; exact INR paise/quantity reconciliation; lot and evaluation chronology preserving fractional seconds; reciprocal evidence references; selected-goal projection reconciliation; refusal to hide unknown profile inputs, unreviewed/withdrawn claims or contradictory evidence behind a declared current result.
- `packages/contracts/test/domain-records.test.mjs`: thirteen synthetic golden groups described below.
- `docs/product/domain-contracts.md`: scope, decisions, all seven DEV-003 categories and exact persistence/consumer mapping.
- `docs/development/domain-contracts-handoff.md`: this handoff and manual acceptance.

The prior integration already added `export * from './domain-records.js'` in `packages/contracts/src/index.ts`; that file was inspected but not edited by this follow-up. No runtime consumer imports this module. Root owns TODO/README/catalogue/status and the eventual scoped commit.

Static review found and corrected four concrete gaps in the original six-group draft: a portfolio could include a later-created lot; a result could accept forged contribution projection outputs; merely declaring current freshness could hide unknown/unreviewed/contradictory supplied inputs; and millisecond timestamp parsing could accept later inputs within the same millisecond. A claim's evidence is now joined in both directions, and evaluation checks all evidence attached to selected claims, including contradictory evidence omitted from the result's selected evidence list.

## DEV-003 coverage and actual data model

| Category      | Shared implementation                                                                   | Persistence already implemented                                                                                                    | Intentionally separate consumer work                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instrument    | `securities.ts` identity/ISIN schemas; instrument graph nodes                           | `security_identities`, `security_identity_revisions`, migration020; `apps/api/src/securities.ts`                                   | Full issuer/listing history remains SRC-001; no new instrument table.                                                                                                        |
| Evidence      | Existing discovery/macro/security schemas; new `DomainDocument` / `DomainEvidence`      | `discovery_versions`, `macro_observations`, `security_identity_revisions`; Mongo `discovery_raw`, `macro_raw`, `security_evidence` | Generic claim graph storage needs an explicit adapter from existing source IDs and source admission.                                                                         |
| Observation   | Reused `MacroObservationSchema` / exact `MacroValueSchema`                              | Migration002, `macro_observations` and `apps/api/src/macro.ts`                                                                     | No new observation dataset or provider claim.                                                                                                                                |
| Event/edge    | New `DomainEvent` / `DomainNode` / `DomainEdge` / `DomainEvidenceGraph`                 | No generic event/edge consumer added                                                                                               | DEV-006/010 event identity, source review, persisted graph and actual impact workflow remain. User research connections are contextual links, not causal facts.              |
| Portfolio/lot | Reused exact holding rows; new owned acquisition lots and reconciled portfolio envelope | Migration009 `app_holdings` / `app_holdings_revisions` / previews; `apps/api/src/holdings.ts`                                      | Current saved totals do not contain acquisition lots. A future consumer needs actual lot inputs, owned history/export/deletion and reconciliation; no fabricated conversion. |
| Goal/profile  | Reused `SavedGoalSchema` / `goalProjection`; new explicit unknown/known `DomainProfile` | Migration005 `app_goals` / `app_goal_revisions`; `apps/api/src/goals.ts`                                                           | Account financial-profile collection, purpose-specific consent and lifecycle are not added; no suitability conclusion.                                                       |
| Policy result | New no-action `DomainPolicyResult` / reconstruction `DomainPolicyPack`                  | Fictional journey `virtual_reviews` in migration001; ordinary record reports remain financial snapshots                            | DEV-010/019 need an approved deterministic educational rule, eligible inputs and actual issuance/reconstruction workflow. Advice stays gated.                                |

Schemas authenticate neither an owner UUID nor a provider. They cannot verify historical storage immutability, source rights or real-world currentness. A result's selected input references and supplied timestamps are checked for internal consistency; source admission and trustworthy freshness computation remain the consumer's job. Declared document hashes are compared without inventing raw bytes. No new financial deletion, valuation, FX, tax-lot disposal, investment return or personal recommendation policy is introduced.

## Authored golden fixtures

Thirteen Node unit groups in `packages/contracts/test/domain-records.test.mjs` cover:

1. An exact synthetic pack with cost `9007199254740993`, unknown values/times preserved and input unchanged.
2. One-paise/millionth mismatch, duplicate/orphan/foreign lots, currency mismatch and malformed number/calendar rejection.
3. Document/hash/claim/version and endpoint mismatches, self-cycle and invalid horizon/ISIN state.
4. Unknown/stale/conflicting assessment refusal, missing blockers and forbidden trade/comparator fields.
5. Wrong input ownership/version, repeated references and unavailable future claims/evidence.
6. Profile unknown-field/consent/predecessor rules, including a valid explicit revision.
7. Full current and revised pack JSON reconstruction, two independent goals of the same type, explicit expected contribution amounts, unchanged prior input and an empty portfolio.
8. Standalone acquisition-after-capture and lot-after-snapshot rejection, including one microsecond; equivalent fractional instants remain valid.
9. One-paise forged goal projection/gap and submillisecond goal/claim/result/consent chronology rejection.
10. Unknown profile fields and candidate/withdrawn claims require unavailable results with explicit blockers; actual zero savings is retained as known zero.
11. A contradictory attachment cannot hide outside its claim or be omitted from result selection to create confidence; later contradictory evidence is unavailable at the earlier evaluation.
12. Reused ISIN checksum and signed 30-decimal observation primitives, explicit missing value, invalid precision/type/unit/extra-field rejection.
13. Event → factor → sector → instrument graph round-trip reconstruction and a multi-edge cycle rejection.

Every new value is labelled synthetic. The valid ISIN is an identifier fixture, not proof of ownership, a provider response or a price. No fixture is imported by production code. Existing adapter fixtures remain in `apps/api/test/securities.test.mjs`, `world-bank.test.mjs`, `holdings.test.mjs`, `goals.test.mjs` and `journey.test.mjs`; no pass is inferred from their presence.

## Layer acceptance and user actions

Specification, contracts, domain behavior and golden fixtures are authored. Data-model acceptance is the mapping above: existing persisted feature records remain unchanged and new generic schemas have no storage consumer. UI, UX, keyboard/mobile/visual states, API/browser/offline E2E and automation are not applicable to this pure schema child because it adds no route, screen, worker or device behavior. No new API/WEB/OFFLINE IDs, services, migration or dependency are required for its unit cases. UI URL: not applicable.

Manual review before validation:

1. Check each of the seven category rows against the actual source and migrations. Confirm that generic schemas are not described as deployed event/policy tables or workflows.
2. Inspect the explicit expected amounts and synthetic labels; verify that document/evidence/claim and owner/version joins reconstruct only supplied editions and never become advice.
3. Check that unknown values remain unknown, actual zero remains zero, and unavailable or contradictory input cannot produce a confident result.
4. Inspect the working tree before the SDLC command: it stages all non-ignored pending changes, including other integrated children. The user/parent must choose the intended commit scope.

For isolated manual contract validation with existing installed dependencies, the user can run:

```bash
pnpm --filter @fingent360/contracts build
pnpm --filter @fingent360/contracts exec node --test test/domain-records.test.mjs
```

Expected: all thirteen groups pass; no database, API, browser or provider access occurs. These commands alone do not authorize a commit or establish application E2E evidence.

For the requested repository gate and commit, after the broader pending batch's documented app/database/migration prerequisites are ready, the user runs:

```bash
pnpm sdlc "Complete reusable domain contracts and golden fixtures"
```

This runs format/check (including these units), stages pending changes, conditionally commits, then runs E2E. PostgreSQL/MongoDB and the printed development URL are prerequisites for that broader E2E step, not for these pure contract cases. This child adds no migration; use the current parent handoff for the status of other migrations and services. Watch/eye mode remains off. On failure, report the first failing stage, test name/assertion and run ID/date; if E2E ran, include `artifacts/e2e/latest.md`. Do not share environment credentials or private documents. No new local commit exists for these changes.

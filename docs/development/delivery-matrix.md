# Roadmap delivery audit — UX-001

Source inspection on 2026-09-12: runtime modules in apps/api/src, apps/web/src, packages/contracts/src and migrations001–009. This is a scope audit, not runtime verification. Root TODO owns task status and exact verification. A bounded child does not complete its broader parent. Historical passes apply only to their original run/version.

## Development parents

| Task    | Current evidence                                                                        | Remaining acceptance / dependency                                                                                                          |
| ------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| DEV-001 | PRD, glossary and canonical model documents exist                                       | Reopened experience review; validate current connected workflows and per-layer specifications. Documents do not implement screens.         |
| DEV-002 | Educational policy, account authorization/origin checks, privacy controls               | Full threat model coverage, abuse/recovery/production policy acceptance. Advice approval separate.                                         |
| DEV-003 | Strict journey, macro, account, goals, holdings, sources, preferences/privacy contracts | Verified security master, events/causal edges, lots and policy-result models/golden fixtures.                                              |
| DEV-004 | PostgreSQL migrations001–009, checksum ledger; Mongo macro evidence                     | Future domain schemas, broader indexes, backup/restore and production migration evidence.                                                  |
| DEV-005 | Real World Bank GDP/CPI adapter and operational source registry                         | Remaining P0 adapters, source rights evidence, reconciliation/quarantine/production acceptance per source.                                 |
| DEV-006 | Macro dashboard and separate synthetic learning journey                                 | Verified multi-point event/sector/company intelligence and corrections workflow.                                                           |
| DEV-007 | Authenticated accounts and manually entered holdings                                    | Production identity/recovery, broader portfolio/lot model and valuation. UX integration under UX-001.                                      |
| DEV-008 | Strict limited CSV preview/confirmation for user-entered holdings; virtual CSV exercise | Representative broker formats, XLSX, corporate-action reconciliation and parser coverage.                                                  |
| DEV-009 | Versioned saved goals with exact contributions; separate entered holdings               | Complete allocation/feasibility policies and goal-impact explanations without invented returns.                                            |
| DEV-010 | Synthetic oil-shock educational exercise                                                | Real accepted oil/event/company evidence and linked holdings/goals reconstruction.                                                         |
| DEV-011 | No durable reports/jobs module found                                                    | PostgreSQL outbox/jobs, leases/retries/idempotency, issued report versions, freshness-aware workflow. Engineering work remains possible.   |
| DEV-012 | Responsive components, manifest and minimal neutral offline worker                      | Connected UX correction, visual/keyboard/mobile acceptance, browser-specific install and broader accessibility review.                     |
| DEV-013 | Advice disabled                                                                         | Counsel/operating model approval, suitability, audit and kill-switch gates; do not activate through UI changes.                            |
| DEV-014 | Umbrella future assets/channels item                                                    | Follow specific DEV-022–029 gates; no broker/channel integration implied.                                                                  |
| DEV-015 | Macro refresh controls and source rights registry                                       | Complete research operations review/repair/monitoring workflows and named operator audit.                                                  |
| DEV-016 | Macro source bodies/revisions, planning/source audit revisions                          | Cross-domain evidence/explanation/correction links and issued-decision reconstruction.                                                     |
| DEV-017 | Consent, own export, session management, account deletion                               | Account recovery, retention policy operations, security hardening and production acceptance.                                               |
| DEV-018 | Saved watchlists, observation receipts and mute preferences                             | Calendar context, batching, materiality criteria and durable delivery; muting is not a material-alert engine.                              |
| DEV-019 | Synthetic educational policy only                                                       | Real versioned research policy, golden scenarios, costs/taxes, no-action comparison and reconstruction.                                    |
| DEV-020 | No additional verified event slice found                                                | Accepted data plus DEV-010/016/019 implementation.                                                                                         |
| DEV-021 | Health/readiness, local SDLC/E2E reports, migration ledger                              | Production observability/release controls, restore drills and worker operations.                                                           |
| DEV-022 | No mutual-fund/bond domain module found                                                 | SRC-015–019 plus complete Indian-equity prerequisites and asset-specific workflows.                                                        |
| DEV-023 | Deferred                                                                                | Other Indian assets after DEV-022, with source/valuation semantics.                                                                        |
| DEV-024 | Deferred                                                                                | International funds after Indian asset gates and SRC-024.                                                                                  |
| DEV-025 | Deferred                                                                                | International equities after DEV-024 and SRC-025.                                                                                          |
| DEV-026 | Deferred                                                                                | Other international assets after DEV-025 and SRC-026.                                                                                      |
| DEV-027 | Deferred                                                                                | Crypto only after prior asset gates and SRC-027.                                                                                           |
| DEV-028 | No broker connectivity module found                                                     | Approved provider app/entitlements, OAuth consent/revocation and reconciliation; credentials/partner gates are real external dependencies. |
| DEV-029 | No WhatsApp/native shell integration found                                              | Channel acceptance, provider setup, session/consent and notification controls; deliberately later scope.                                   |
| DEV-030 | No billing/entitlement implementation found                                             | Explicit business-model decision; do not invent prices or monetization ranking.                                                            |

## Source parents

All rows require real access/usage evidence before production acceptance. A candidate URL, a registry entry or public accessibility does not satisfy that requirement. Rights review and adapter engineering are separate work; absent research is not automatically an external blocker.

| Task    | Source family                   | Current scope and remaining work                                                                                 |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| SRC-001 | Security master                 | No adapter; obtain permitted representative data and implement ISIN/symbol identity reconciliation.              |
| SRC-002 | Indian EOD prices/volume        | No adapter; rights, timestamps/revisions and price reconciliation required. No live valuation currently claimed. |
| SRC-003 | Corporate actions               | No adapter; adjusted/unadjusted history and entitlement reconciliation remain.                                   |
| SRC-004 | Filings/results                 | No adapter; filing provenance, revisions and extraction validation remain.                                       |
| SRC-005 | Fundamentals                    | No adapter; units, reporting periods and canonical reported facts remain.                                        |
| SRC-006 | Index/sector                    | No adapter; membership/classification versions and usage rights remain.                                          |
| SRC-007 | India macro                     | World Bank annual India GDP/CPI works as a bounded child; RBI/MoSPI and broader India releases remain.           |
| SRC-008 | Global macro/rates              | No adapter; permitted source selection and normalization remain.                                                 |
| SRC-009 | Oil/commodity/FX                | No real adapter; synthetic oil fixture is not source onboarding.                                                 |
| SRC-010 | FII/DII/FPI flows               | No adapter; reporting revisions, units and licensed/public usage review remain.                                  |
| SRC-011 | Participant positioning         | No adapter; explicit research interpretation and data rights remain.                                             |
| SRC-012 | Company/market news             | No adapter; publication/extraction rights and corrections remain.                                                |
| SRC-013 | Portfolio spreadsheets          | Limited user-input CSV implemented; representative broker/XLSX parsers and reconciliation remain.                |
| SRC-014 | Regulatory/tax sources          | Blueprint links exist; monitored/versioned source ingestion and expert-reviewed applicability remain.            |
| SRC-015 | MF scheme master/NAV            | Later Indian-fund gate; no adapter.                                                                              |
| SRC-016 | MF holdings/factsheets          | Later Indian-fund gate; no parser/adapter.                                                                       |
| SRC-017 | G-sec/yield curve               | Later bond gate; no adapter.                                                                                     |
| SRC-018 | Corporate bonds/ratings         | Later bond gate; no adapter.                                                                                     |
| SRC-019 | CAS/MF statements               | No parser; permission, sensitive-document handling and representative reconciled formats required.               |
| SRC-020 | Consensus/revisions             | Outside P0; licensed entitlement and source validation may be necessary.                                         |
| SRC-021 | Broker APIs                     | No integration; provider application access, OAuth entitlement and consent required.                             |
| SRC-022 | ETFs/gold/commodities           | Later Indian-assets gate; no adapter.                                                                            |
| SRC-023 | Derivatives analytics           | Later gate; no adapter or suitability-approved analytics workflow.                                               |
| SRC-024 | International funds             | Later asset gate; no adapter.                                                                                    |
| SRC-025 | International equities/ETFs     | Later asset gate; no adapter.                                                                                    |
| SRC-026 | International bonds/commodities | Later asset gate; no adapter.                                                                                    |
| SRC-027 | Crypto market/on-chain          | Last-stage gate; no adapter.                                                                                     |

## Sequencing

UX-001's current account workflow is implemented and verified; see root TODO for exact evidence. Next deliver verified Indian-equity identity/valuation with its real adapters and user reconciliation flow, connected owned-holding goal allocations, then a verified evidence-to-portfolio research journey. Implement supporting durable jobs, reports, policy and operational controls alongside those user outcomes. Root TODO's “Next complete product workflows” provides full-layer prompts and acceptance over the existing parent IDs. Keep advice, provider entitlements, new channels, later assets and commercial decisions at their explicit gates. Do not stop all engineering because one production source approval is unavailable, or substitute infrastructure completion for a working user journey.

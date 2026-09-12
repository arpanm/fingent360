# SLICE-001 educational policy and access design

Implemented scope: a local synthetic exercise, not a production research/advice service. Version `educational-demo-v1`. This design is a bounded contribution to DEV-002; it does not assert legal approval or resolve that task's production threat model.

## Deterministic result rules

1. Missing holdings or goals, or an explicitly simulated stale/conflicting input, yields `unable_to_assess` with reasons. Historical fixture valuation may be displayed, labelled as such; it cannot become a current assessment.
2. Valid baseline fictional inputs with positive Alpha Air exposure yield `review`. This means inspect the mechanism and goal context; it does not recommend a trade.
3. Valid baseline inputs with no mapped direct exposure yield `no_review_trigger`. This says nothing about unmapped risks and is not a hold recommendation.
4. Every issued record freezes the full portfolio/goals, computed valuation, input condition, revision, fixture version, policy version and issuance time. The original survives later portfolio changes. All source notes are fictional and versioned with the fixture.
5. The only comparator is leaving the virtual holdings unchanged. No invented performance, probability, costs, tax estimate, buy/sell/rebalance amount or trade execution.

## Scope decisions relative to DEV-001

This implementation uses two fictional instrument slugs, fixed INR prices, hash navigation and a single virtual portfolio per workspace. These identifiers must never be promoted into a live security master/ISIN mapping. Baseline means valid within the exercise, not current market freshness. No external source was onboarded.

Goal percentages apply uniformly to the entire portfolio, including cash, rather than allowing per-position allocations yet. For INR 2000 total and INR 1000 oil-linked equity, 40% funds INR 800 toward a goal and attributes INR 400 of exposure. The DEV-001 example earmarking only equity remains a later allocation capability. Users explicitly edit and save the displayed defaults; each save creates a revision. A past target date is allowed for tracking overdue goals; no success or suitability model is implied.

Quantities support six decimals. Fixed prices use INR minor units. Each position is rounded half-even to paise; total is the sum of those booked values plus cash. Allocation rounds down to paise and retains the remainder as unallocated capital. Funded and exposure percentages round half-even to two decimal places. Source total reconciliation requires an exact match to this rule (zero tolerance). Zero total yields unavailable exposure percent. Limits bound input size and integer arithmetic; no monetary calculation uses JavaScript floating-point values.

## Access and uploaded content

| Threat                                    | Implemented control                                                                                                                                                                                            | Remaining production work                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Cross-workspace access                    | Cryptographically random 256-bit capability; only its SHA-256 hash stored in PostgreSQL; every private query scoped to that hash; missing/wrong capability cannot read a workspace; private responses no-store | Authenticated real accounts, expiry/rotation, household roles and consent lifecycle in DEV-007/017 |
| Stolen browser key                        | Virtual data only; explicit browser-key explanation; deletion revokes access and cascades through stored rows                                                                                                  | HttpOnly authentication, CSP, managed sessions; do not use this scheme for real holdings           |
| Imported instructions / formulas / markup | Only exact template header and allowlisted instrument/decimal rows accepted; no tools, LLM, formulas or HTML execution; React text rendering                                                                   | Approved parser corpus and secure real-upload pipeline                                             |
| Conflicting/replayed writes               | Row lock, revision precondition, idempotency key plus content hash; atomic import confirmation; identical confirmed content rejected on a new key                                                              | Broader account/export reconciliation policies                                                     |
| Raw upload retention                      | Raw CSV is not stored; only validated staging values and errors retained; previews usable for 24h, old previews purged on next preview; 100 staging rows/workspace cap                                         | Scheduled retention, quotas/rate limits, production privacy policy                                 |
| Deletion                                  | Explicit user action deletes workspace plus dependent previews, mutation history and reviews                                                                                                                   | Backups and production deletion audit policy                                                       |
| Database outage                           | Transaction rollback and safe 503 response; UI retains draft and provides reload/retry                                                                                                                         | Operational alerts and recovery drills                                                             |

No migrations or seeds run on application startup. The manual migration is transactional, serialized with an advisory lock and additive. It preserves existing data. PostgreSQL stores versioned JSON payloads for this small slice; typed contracts validate reads/writes. Full normalized domain tables, least-privilege DB roles, Mongo extraction storage and outbox remain DEV-004 work. The public fixture is an immutable source-code artifact, not a scraped document.

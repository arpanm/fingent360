# DELIVERY-TEAM-004 — implementation handoff

This batch is authored and integrated, **not executed or verified**. The nine requested workstreams have separate specifications, code, tests and handoffs. The session admitted three concurrent workers beside the coordinator, then rejected additional agent threads; completed workers were reused. Nine distinct agent threads were not created.

| Workstream and handoff                       | Delivered code                                                                                                                                                                       | Remaining requirements                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [Indian equity](equity-coverage.md)          | Immutable source editions, five observation families, NSE security master/Nifty50 constituents and documented UDiFF price ZIP ingestion, review, company reader and offline snapshot | BSE/other series, historical identity reconciliation, corporate-action/fundamental parsers, adjusted-price history and unattended backfill |
| [Five brokers](broker-importers.md)          | Strict capability catalogue and connected actual mapped import for all five broker guides                                                                                            | **Named parsers 0/5**: complete verified export layouts and acquisition-cost reconciliation evidence still missing                         |
| [Impact traces](impact-trace.md)             | Retained evidence/equity/conflicts → reviewed context → owned holdings/goals, immutable exact baseline receipts and privacy/offline lifecycle                                        | Proven causal transmission, numerical elasticities and exhaustive conflict research                                                        |
| [Action centre](action-centre.md)            | Actual disposal/no-action calculation with explicit costs/tax assumptions, suitability/liquidity/reserve/concentration/turnover/cooldown constraints and owned receipts              | Broader buy/rebalance policies, actual tax-lot and verified transaction-history calculations                                               |
| [Event scenarios](event-scenarios.md)        | Seven evidence-bound family workflows, exact comparisons, independent review, public history/details and offline reader                                                              | Complete verified live event packs; only one historical BLS numeric golden independently sourced, other fixtures explicitly synthetic      |
| [Automatic research](research-automation.md) | Durable automatic capture, pause/interval controls, BEA calendar capture history and approved source policies that publish eligible news automatically                               | Other official calendars and original historical numerical publication vintages                                                            |
| [Funds and bonds](funds-bonds.md)            | Permission-gated AMFI NAV ingestion/review/history, owned cash-flow/accrual/XIRR/duration/deposit comparisons and offline persistence                                                | AMFI permission/live-file acceptance, AMC look-through, bond market quotes/ratings and broader conventions                                 |
| [Evaluation lineage](evaluation-lineage.md)  | Actual public call/raw-output logs, source/composite-media views, feedback links/export; separate opt-in private history with expiry/revocation/deletion                             | Live acceptance and any future evaluator scoring; view-model capture is not proof of pixels rendered                                       |
| [Story media](story-media.md)                | Configured image generation, immutable provider output, exact-image review, shared/offline images, removed arrow placeholder and transient gesture overlay                           | Live image-provider and physical-device acceptance; no generated-video claim                                                               |

Root integration includes contract exports, API controllers/providers, routes/Operations, offline handlers/snapshots, privacy export/deletion and migration registration. Additive migrations are049,051–057;050 is intentionally unused because broker guidance reuses existing storage. Existing runtime grant refresh covers the new tables/sequences. No dependency was added.

## Manual activation and focused validation

Agents did not run format/check/build/tests, migrations, source jobs, service changes, APK generation or commits. The local commit remains conditional on successful user-run gates. No push was performed.

First build the current migration code and apply the additive migrations, then start the app:

```bash
pnpm build
pnpm db:up
pnpm db:migrate
pnpm dev
```

Use the printed web URL. More exposes Indian companies, Evidence and my plans, Explore a change, Understand a release, Funds and bonds and Release calendar. Operations exposes source review, Automatic research, Fund data, Event scenarios and Research evaluation. Privacy contains optional My AI request history.

For format/check and gated commit without the entire E2E suite:

```bash
pnpm sdlc "Add research data and experience workflows" --checks-only
```

Then select the relevant cases in `E2E_BROWSER=chrome pnpm e2e:ui`, or use the individual workstream `pnpm sdlc ... -- --grep ...` commands in each handoff. Keep watch/eye mode off. Authored cases and project IDs are in `tests/e2e/CATALOG.md`; they cover owned real storage with explicitly synthetic financial/provider fixtures where marked. They do not prove live provider availability or usage permission. Send the run ID in `artifacts/e2e/latest.md`, exact failing case/project and error context if validation fails.

Automatic capture defaults on while the API runs; set `RESEARCH_AUTO_ENABLED=false` to disable it globally or pause individual schedules. To add future eligible official news to Today/Stories automatically, review and approve a per-source publication policy in Operations → Automatic research. Policies are versioned/expiring; named mode requires independent approval. Other drafts still require ordinary review. No policies or source permissions were activated during authoring.

Image generation defaults off. Configure `STORY_IMAGE_PROVIDER` and a supported `STORY_IMAGE_MODEL` with its matching server key, then request a visual in Operations and approve the exact returned image. Provider keys stay server-side. Source text is the fallback; no arrow is presented as an image. Optional private request history is a separate consent, seven days and at most50 requests, with owner-only download/deletion.

For Android after admitting the desired public data:

```bash
pnpm android:snapshot
pnpm android:build
```

Reinstall the resulting APK. An already installed offline APK does not receive repository edits automatically. Its public corpus remains a dated snapshot; private records use the shared on-device implementations. Recheck real touch gestures, large font/reduced motion, feedback queue/sync and image rendering on the device. No physical-device or visual acceptance is claimed for this batch.

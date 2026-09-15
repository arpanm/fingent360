# Current delivery — what exists and what remains

This summary reconciles the previous nine-workstream handoff on 2026-09-15. **Seven workstreams remain partial. Evaluation lineage and image-based stories have their bounded implementation authored, but validation is pending. The batch is not complete end to end.** Source files, migration registrations and the previous detailed handoffs were inspected; no gates, live provider calls or device tests were run for this reconciliation.

“Implemented” below means code is present/authored. It does not mean the database migration is applied, a source/provider is configured, tests pass or an installed Android APK contains these changes. Recent repair records still report failed validation stages; no later clean batch-wide result is established here.

| Workstream                                                                                          | Implemented / authored                                                                                                      | Still missing or unverified                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Indian equity reference, prices, actions, fundamentals and sectors](EQUITY-COVERAGE-001.md)        | NSE identities, Nifty50 constituents, UDiFF price ingestion, stored revisions and company/offline views are authored.       | Implement corporate-action and fundamental parsers, adjusted prices, broader exchange/sector history and backfill.                                       |
| [Five verified broker import formats and reconciliation](BROKER-PARSERS-002.md)                     | Five platform guides and the generic mapped import flow are authored.                                                       | All five named/versioned parsers are missing: Zerodha, Groww, Upstox, Angel One and ICICI Direct. Quantity/cost reconciliation evidence is also missing. |
| [Real evidence to factor, sector, company, holding and goal trace](IMPACT-TRACE-001.md)             | Saved evidence/context/company/holding/goal links and stale/conflict checks are authored.                                   | Verified causal transmission, numerical sensitivities and complete impact policies are missing.                                                          |
| [Deterministic educational action comparison and suitability constraints](ACTION-CENTRE-001.md)     | Disposal versus no-action calculations, constraints and saved receipts are authored.                                        | Buy/rebalance policies and actual tax-lot/transaction-history calculations are missing.                                                                  |
| [Verified policy, macro, company and liquidity event scenarios](EVENT-SCENARIOS-001.md)             | Seven event-family workflows, independent review and history are authored; one BLS historical numeric golden is sourced.    | Complete real-evidence event packs and verified outcomes remain missing; most fixtures are synthetic.                                                    |
| [Automatic source ingestion, release calendar and historical vintages](RESEARCH-AUTO-002.md)        | Automatic source capture, schedule controls, approved news publication policies and BEA calendar history are authored.      | Other release calendars and original numerical publication vintages remain missing; live activation is unverified.                                       |
| [Indian mutual funds, bonds, XIRR and deposit comparisons](FUNDS-BONDS-001.md)                      | AMFI ingestion/review and cash-flow, accrual, XIRR, duration and deposit calculations are authored.                         | Live AMFI acceptance/permission, fund look-through, bond quotes/ratings and broader conventions are missing.                                             |
| [Retained source, LLM call/output, final-view and feedback evaluation lineage](EVAL-LINEAGE-001.md) | Source captures, model requests/raw outputs, composed-view records, feedback links and opt-in private history are authored. | Live/provider acceptance remains pending. Automated evaluator scoring is not included; stored view data does not prove rendered pixels.                  |
| [One-time animated gesture help and generated story media](STORY-MEDIA-002.md)                      | Image generation/retention/review, shared/offline images and one-time animated gesture help are authored.                   | Live image-provider and physical-device acceptance remain pending. Generated video is not implemented.                                                   |

The current local commit observed during this reconciliation is `09b3b1e` (`Add research data and experience workflows`). That confirms a commit exists, not that every E2E/provider/device check passed. The tracker restructuring itself is still uncommitted.

## Who needs to act

The developer should research the remaining official exchange/broker/source formats and implement the missing parsers, causal policies, event packs, calendars and fund/bond feeds. These are development gaps, not a request for the user to discover the formats. If a source genuinely requires account access or permission, record the exact provider/input needed in that source task and continue independent work.

An operator must enable only permitted sources, approve an eligible automatic-publication policy and configure image-provider credentials before expecting new published stories or generated images. Automatic capture/publication code existing does not mean those policies were activated. Do not post provider keys in task files.

The user runs validation and supplies phone feedback. Migrations049 and051–057 are authored; this reconciliation does not establish whether the current local database applied them. Android uses shared web code, but the installed offline APK must be rebuilt and reinstalled; it does not update from repository edits. Generated video is not implemented under STORY-MEDIA-002. A separately existing visual-explainer/WebM path must not be confused with generated story videos.

See [batch activation instructions](../development/team-004/README.md#manual-activation-and-focused-validation) for prerequisites and existing manual commands. Review the complete pending working tree before invoking SDLC: the launcher stages all nonignored changes.

## Sources still incomplete

- **Indian equities:** broader exchange/security history, corporate actions, fundamentals, adjusted prices and wider sector/index history. NSE identity/Nifty50/UDiFF code does not complete these families. Track SRC-001–006.
- **Broker exports:** all five named parsers remain missing; generic mapped CSV/XLSX imports are available. Track DEV-008, SRC-013 and BROKER-PARSERS-002.
- **Economic/event coverage:** remaining official release calendars, original numerical publication vintages, verified live event packs and broader flow/positioning/regulatory feeds. Track SRC-007–014, RESEARCH-AUTO-002 and EVENT-SCENARIOS-001.
- **Funds/bonds:** AMFI live acceptance/permissions, AMC holdings/factsheets, yield curves, bond quotes/ratings and verified statement imports. Track SRC-015–019 and FUNDS-BONDS-001.
- **Later coverage:** consensus feeds, broker connectivity, other Indian assets, international assets and crypto remain separate planned/deferred source tasks SRC-020–027. They are not silently included in the recent delivery.

Each linked source task carries its own scope and next action. “Partial” is not “no data”: existing admitted source families remain useful, but incomplete categories are not called finished.

## Tracker maintenance

[TODO.md](../../TODO.md) now contains only task rows. Each task’s prompts, implementation history, evidence and remaining scope live in its own file here. The [maintenance rules](README.md) require updating both the detailed record and its index row after each implementation. [Historical batch handoffs](../development/team-004/README.md) are preserved for supporting details, not used to imply new passes.

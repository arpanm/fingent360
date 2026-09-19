# BROKER-PARSERS-002 — Five verified broker import formats and reconciliation

- **Status:** Partial
- **Implemented / recorded:** Five platform guides and the generic mapped import flow are authored.
- **Pending:** All five named/versioned parsers are missing: Zerodha, Groww, Upstox, Angel One and ICICI Direct. Quantity/cost reconciliation evidence is also missing.
- **Next action / inputs:** Official research covered all five download paths but not complete export layouts. Zerodha account/template availability question is pending; continue only with verified schemas. Generic mapping remains usable.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Broker guide selection repair — 2026-09-17

Make the broker selector expose the exact stable accessible name Your broker, independent of its option text. Preserve one selected guide at a time and the reviewed mapping CTA. Update legacy guide cases to select each broker before asserting its source link; keep unsupported-parser and cost warnings explicit. Shared web/Android code changes only; existing capability contracts, API, storage and mapped reconciliation remain unchanged. No verified broker parser or source rights are newly claimed. Validation not run; existing saved failures remain open until rerun.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### BROKER-PARSERS-002 — Five verified broker import formats and reconciliation

- **Status:** Partial: shared five-broker capability catalogue and connected mapped-import guidance authored. Named parsers 0/5: complete official export layouts and acquisition-cost reconciliation remain unverified. Verification not run; no migration050 needed.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver five verified broker import formats and reconciliation with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on BROKER-PARSERS-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User previously said to do all five, choose the order and research formats. Order recorded here is the agent’s choice, not a missing user preference.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Ask only for a specific redacted account-only schema/example after official public documentation is exhausted; no account secrets or real holdings.
- **Next action:** Agent: research Zerodha first, then Angel One, Groww, Upstox and ICICI Direct; request samples only if public evidence is insufficient.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Pickup research and concrete input gap — 2026-09-15

Reopened official [Zerodha holdings download help](https://support.zerodha.com/category/console/portfolio/console-holdings/articles/holding-report): dated Console exports are XLSX; this page does not publish a workbook template, full column set, numeric precision or exact acquisition-cost total reconciliation. The existing earlier official-video/UI inspection in [broker-dialects research](../product/broker-dialects.md) likewise showed the download control, not the file contents. An account-only layout cannot be established from the control screenshot. No real customer workbook or account was accessed.

[Official Kite Connect holdings documentation](https://kite.trade/docs/connect/v3/portfolio/#holdings) has a JSON response schema. That is a different API product, not evidence for the Console workbook. It is not silently substituted for the requested file importer. A rounded average price does not by itself establish exact source acquisition cost.

Then checked [Angel One holdings statement help](https://www.angelone.in/support/reports-and-statements/holding-statement). It documents downloading an Excel statement and describes quantity/average price, but does not publish a complete workbook schema or cost-total rule. Public search for an official XLSX sample returned unrelated documents rather than a statement template. Generic educational demat field descriptions are not exact export layouts. No named parser is enabled from these incomplete descriptions.

**Concrete proposed input question (unanswered; sent to coordinating agent):** Can you provide a sanitized Zerodha Console holdings XLSX template preserving sheet names, preamble/header/footer, blank layout and cell number formats, with one invented holding row? Remove name, client/account IDs, PAN, all real holdings and any hidden personal workbook metadata. A broker-published empty template or formal schema is equally useful. We need layout/precision only, never login details, tokens or actual financial data. Also preserve a source total/cost label if the export contains one; if none exists, we will use the existing explicit user-attested-cost reconciliation rather than call an average-price product exact cost.

**Readiness change for Zerodha named XLSX:** Waiting for this unavailable format input after primary public research. Existing mapped/supplemented imports remain implemented; other independent tasks can continue. Exact same limitation remains for Angel One; do not ask the user to research regulations or choose broker order again. The next broker's public research can proceed separately. No verified named parser or test pass is claimed; 0/5 remains accurate.

Manual documentation acceptance: task distinguishes Console XLSX from Kite API JSON; linked evidence supports only the stated download path; future input is sanitized structure, not private data; existing mapped path remains available. No application behavior was changed by this research entry.

### Remaining three primary-source checks — 2026-09-15

| Broker       | Official evidence inspected                                                                                                                 | What it establishes                                                                                     | Still unavailable for a reliable named export parser                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groww        | [Product update: Stock Holding Statement](https://groww.in/updates/updates-from-groww-tax-loss-harvesting-intraday-oco-bonds-and-lots-more) | A selected-date stock holding statement is available from Reports.                                      | Actual export format/template, sheet and headers, holdings quantity scope, ISIN representation and exact cost-total/rounding rules. The adjacent order-history feature is a separate report.         |
| Upstox       | [Holdings report help](https://upstox.com/help-center/how-can-i-check-my-holdings-248548/)                                                  | Reports → Holdings report → date filter → Get Report → Excel/PDF download; linked pictures show the UI. | Complete downloaded workbook layout and acquisition-cost fields/precision. A dated report and displayed valuation do not establish acquisition cost.                                                 |
| ICICI Direct | [Portfolio download help](https://www.icicidirect.com/faqs/stocks/how-can-i-download-a-summary-of-my-portfolio-on-website)                  | Both old/new website instructions use Stocks → Portfolio → Download and a format choice.                | Exported headers, format/version, position-versus-demat scope, price/cost basis and source reconciliation total. API/Breeze sample JSON and mutual-fund capital-gains CSV describe different inputs. |

Targeted public official-site searches for holdings statement samples/XLSX did not identify an actual downloadable schema fixture for these three. Search absence is bounded to this review, not proof none exists anywhere. Therefore all five still need a sanitized layout or primary published schema before named automatic file parsing. General mapping and exact user-attested costs remain the truthful route meanwhile. No provider account, message, private download or paid service was accessed. No follow-up input answer is assumed; coordinating agent has queued the first concrete Zerodha availability question.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789836492361-20464.
<!-- sdlc-validation:end -->

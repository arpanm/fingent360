# SDLC-REPAIR-016 — Repair failures from the complete validation inventory

- **Status:** Done (accepted recorded repair scope); two new investigations tracked separately
- **Implemented / recorded:** Repaired the saved failure inventory and current browser/API regressions; full current reviewed repair matrix passes. The new scheduler intermittency and Mongo restoration findings have their own explicit task records.
- **Pending:** No failed requirement remains in the reviewed repair matrix. Do not treat this as closing READINESS-RECOVERY-001, RESEARCH-WORKER-ISOLATION-001 or source/provider/device gates.
- **Next action / inputs:** Follow the two specific investigations and remaining non-test gates; another complete suite is not requested for this unchanged revision.
- **Verification:** SDLC1789852776002-50046 passed normal gates,1317 connected cases and208 offline cases, with one API2002 failure and deliberate API004 skip. final-scoped-1789857073654 then passed both exact cases unchanged. All107 reviewed matrices now pass at the same source fingerprint; original failure evidence is retained.

## Specification and acceptance

Inspect the exact saved run, selected cases/projects and error artifacts before changing code. Repair demonstrated API/UI/parser defects or stale fixtures while preserving independent review, strict schemas, actual storage/publication flows and provenance. Do not replace real workflows with passing mocks, relax production authorization, force clicks through layout defects, increase timeouts without evidence or infer success from authored code. Draft corrections outside the repository while a validation stage is active, then reconcile and integrate after it finishes.

Web and Android share UI/contracts; offline handlers and installed-snapshot cases remain separate acceptance. A failed-case repair selection is not a replacement for a functional story’s complete reviewed matrix. A deliberately skipped database-outage test remains a separate required gate when included by its foundation scope. Record any concrete data-model/migration need before introducing it.

## Reusable task prompt

Read AGENTS.md, this authorization record, docs/development/functional-acceptance-2026-09-20.md and the latest saved failure artifacts. The user explicitly authorized the parent to execute this complete validation and repair pass; that current exception supersedes the manual-only default for this work, but does not authorize future unrelated execution. Fix confirmed failures, preserve real independent review/storage and source evidence, add or repair bounded regressions, and update the affected task/TODO/catalogue records. Run the normal gates and affected validation only under that existing authorization. Do not push. Generated validation and bug blocks remain owned by the recorder; never turn an authored repair into a fabricated pass.

## Original repair selection and manual fallback

The original run `1789752953639-97020` recorded119 failed case/project pairs. Its reviewed SDLC-REPAIR-016 matrix contains those failures plus API360, the storage-classification companion to API359. The historical scoped command remains `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`, with existing migrated PostgreSQL/MongoDB/API/web prerequisites. It runs normal gates and the configured connected/offline repair selection, not a new full-inventory pass. Current focused follow-ups also include newly authored functional coverage outside that historical119-case set; keep their explicit selection and saved run evidence.

## Authorized complete validation — 19 September 2026

The user explicitly requested agent execution of all pending validations and repair of failures. SDLC `1789837762812-24470` ran the complete connected/offline inventory with nested automatic repair disabled. Format/check passed and the gated commit was `4549ca1`. Connected receipt `2026-09-19T17-25-29-087Z-25373` selected1293 cases:1275 passed,17 failed and one deliberate database-outage skip. The203 offline cases passed. The combined result is1478 passes,17 failures and one skip; repeated desktop/mobile manifestations are not separate production root causes.

Reviewed matrices and targeted repairs/new acceptance were then integrated at gated commit `3e97222`. The current focused E2E run `1789846831614-a2f50ba5-a13b-4918-ad13-91d1611b7b34` started `2026-09-19T19:40:31.614Z` against API `http://127.0.0.1:4104` and web `http://127.0.0.1:5176`, with86 selected cases. It remains running at this update; consult the saved report for later progress and final counts.

### Confirmed causes and focused follow-up

- API1851 mutated a repeated January chart value belonging to January28 rather than its selected February11 vintage. Its scoped fixture correction targets the selected point; the current focused report records API1851 passing.
- API1880 subscribed to GDP without a published item exposing that topic. Its fixture now uses an actual published topic. API1603 attempted to update an append-only discovery revision; the repair appends a withdrawn revision and advances the head. These changes preserve the original workflow assertions.
- API1573 completed its401/redaction assertions before fixture teardown overlapped recorded macOS sleep. The power logs show31m24s of sleep during the initial invocation; no production authorization change or arbitrary timeout increase followed. Current focused evidence records API1573 and API308 passing. The temporary process-bound sleep assertion changes no permanent power setting.
- WEB1710 mobile overlap was reproduced and corrected with wrapping; its focused mobile retry passed. This scoped result does not establish other mobile or full-suite acceptance.
- WEB1360 originally used a browser fixture that did not route its company lookup into its owned API. After that routing correction, the current saved context contains the real classification combobox and Synthetic industry option, but exact getByLabel still fails because its wrapping label includes the select’s option text. The confirmed follow-up uses the exact combobox role/name for visibility and clearing assertions, preserving the independent reviewer and real public company read. This locator correction is drafted outside the repository pending integration and validation.
- API1940’s original public503 masked its underlying exception; clock skew was only an inference, not confirmed RCA. The current focused report records API1940 passing. No clock repair or general environment diagnosis is claimed from that retry.
- Current focused failures also include API1120 and desktop WEB1295–1297. Their saved failures remain open while their exact causes and corrections are reviewed; mobile policy-case passes do not substitute for desktop acceptance.

No overall pass or resolved bug is inferred from this narrative. Generated validation below is preserved verbatim and may refer to the preceding reconciliation until the active recorder finishes.

### Final focused repair result — 20 September 2026

All newly found shared causes are repaired and their focused checks now pass: query fallback, public cursor routing, selectors/native keyboard, narrow text wrapping, fixed furniture, wrapped-link hit testing and offline reload readiness. Receipt2026-09-19T20-00-04-465Z-41642 passed12 browser cases, followed by the rebuilt OFFLINE081 pass. Final current-revision complete acceptance remains in progress; generated validation/bugs must come from that actual run.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789927529684-81206.
<!-- sdlc-validation:end -->

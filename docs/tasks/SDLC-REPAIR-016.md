# SDLC-REPAIR-016 — Repair failures from the complete validation inventory

- **Status:** User-authorized agent validation and targeted repair in progress; no complete current pass claimed.
- **Implemented / recorded:** The earlier119-failure repair batch is documented in [the original full-audit RCA](../development/full-audit-2026-09-19.md). The subsequent complete run `1789837762812-24470` finished with1478 passes,17 connected failures and one deliberate outage skip. Confirmed repairs and reviewed story matrices were integrated at gated commit `3e97222` for focused validation.
- **Pending:** Finish the active focused run, diagnose its saved failures, integrate confirmed corrections after the running stage, and validate affected cases. Keep complete functional-story requirements, deliberate outage acceptance, source permissions and physical-device gates distinct.
- **Next action / inputs:** The authorized parent owns the active validation and scoped retries; no repeated user permission or new private input is needed for these confirmed repairs. Preserve generated failures until actual saved passing evidence reconciles them.
- **Verification:** Initial complete inventory:1275 connected passes,17 connected failures, one skip;203 offline passes. Focused E2E run `1789846831614-a2f50ba5-a13b-4918-ad13-91d1611b7b34` is still running at this update. See [current review](../development/functional-acceptance-2026-09-20.md) and generated validation below.

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

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789846773980-36608.
<!-- sdlc-validation:end -->

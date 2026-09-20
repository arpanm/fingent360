# ACTION-CENTRE-001 — Deterministic educational action comparison and suitability constraints

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** Versioned educational sell/FIFO/buy/rebalance comparisons, materiality and suitability guards, no-action baseline, independently released policy bounds, restricted source-documented disposal tax plus reviewed tax-input fallback, encrypted immutable receipts, API/web/Android-shared/offline workflows and authored tests.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Reviewed functional closure — 2026-09-17

The complete required API/browser/offline matrix is recorded in `docs/tasks/acceptance.json`. Implementation of its supported functional scope is complete; the new repairs remain unvalidated. User command: `pnpm sdlc "Complete ACTION-CENTRE-001" --story ACTION-CENTRE-001`. SDLC may mark the accepted functional scope Done only after all required current cases and checks pass. Live-source/editorial activation and native production release remain separate operational prerequisites, not permissions inferred from these tests. See [consolidated commands and completed scope](../development/core-journey-acceptance.md). Existing failure records stay open until observed passing reruns.

## Comparison selection repair — 2026-09-17

Make saved holding, saved goal, comparison type, tax calculation, price basis, reviewed context and released policy selectors expose stable accessible names independent of current option content. Lock the external policy selector while a comparison is being reviewed or saved. Preserve selected IDs, exact financial calculations, owned API choices, encrypted receipts and offline implementation. Existing WEB990/1280/1283 and offline comparison cases exercise the controls; no database migration or new calculation policy is needed. WEB990 passed on desktop/mobile in user-run1789668919723-57996. The additional buy/rebalance/tax-policy selector fixes still await WEB1280/1283 and released-policy acceptance; saved failures remain open until their rerun.

## Implementation handoff rule

Static review follow-up, 2026-09-15: saved API/offline comparisons now recompute review flags for the rebalance purchase price as well as the primary price, and flag the restricted tax policy after its March2027 review boundary. The immutable historical calculation remains unchanged. Focused API/WEB/OFFLINE1280 assertions and contract date-boundary coverage are authored, not executed. The existing saved-comparison review UI displays these flags; no DB change or dependency is needed. Manual command: `pnpm sdlc "Review all saved action comparison price dates" -- --grep 'E2E-(API|WEB|OFFLINE)-1280'`; use the configured DB/API/web, printed development URL → #action-centre, and report failed ID/project plus saved artifact. No agent format/check/test/build/migration/commit ran.

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ACTION-CENTRE-001 — Deterministic educational action comparison and suitability constraints

- **Status:** Partial: exact educational disposal/no-action comparison with constraints, receipts and offline flow authored. Broader buy/rebalance and actual tax-lot policies pending. Verification not run; migration052 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver deterministic educational action comparison and suitability constraints with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ACTION-CENTRE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User: use free sources first and have the agent determine regulations, source usage and formats; do not ask the user to discover them.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** Developer: implement buy/rebalance and verified cost/tax-lot inputs.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Completion implementation — 2026-09-15

Author buy/rebalance comparison alongside legacy disposal using immutable existing comparison receipts, actual saved holding/goal versions and explicit target purchase inputs. Exact source lots must reconcile quantity and cost to saved holdings before FIFO disposal; retained acquisition dates/cost/source references are user-supplied evidence, not invented broker facts. Apply whole-portfolio cost concentration, aggregate turnover, funding/settlement/cooldown/loss-capacity and no-action comparison. Do not turn cash spent on purchases into additional goal savings. Preserve API ownership/replay/export/delete and local parity. Legacy receipt reconstruction must remain unchanged.

Primary tax research: Income Tax Department [capital gain overview](https://www.incometaxindia.gov.in/w/capital-gain) describes demat FIFO and special grandfathered costs; [sale of shares](https://www.incometaxindia.gov.in/en/sale-of-shares) describes the listed-security holding period. These do not establish the user's residency, STT eligibility, other gains/losses, surcharge or actual cost basis. The comparison must retain exact lot results and explicit tax/fee input provenance rather than silently calculate a filing liability from incomplete personal facts. Full statutory tax-return computation is not the educational action workflow.

Tests to author cover exact buy funding, two-security rebalance and FIFO cost reconciliation, mismatched/duplicate/future lots, unchanged finances, replay/privacy/export/delete and shared offline results. Root owns action-centre files; governance agent owns independent reviewed policy releases. No deterministic execution.

Detailed implementation and scoped cases: [action-plan completion](../development/action-plan-completion.md). API1280–1282/WEB1280/OFFLINE1280 plus contract goldens are authored, not run.

Current completion boundary: [supported policy, explicit exclusions and manual tests](../development/action-plan-completion.md). Earlier broad missing buy/rebalance/FIFO statements are superseded; no test pass or universal tax filing is claimed.

## Focused acceptance repair — 20 September 2026

WEB1295/1296/1297 pass mobile but desktop native select did not commit Home/ArrowDown before Tab. Explicitly open/select/confirm desktop popup; preserve passing mobile sequence, full policy/source/replay/stale-source assertions and actual keyboard navigation.

Evidence: connected run2026-09-19T19-40-29-161Z-37323 completed76 passes and10 failures. Repair authored; subsequent validation pending. User explicitly authorized agent execution for this closure pass. Reuse the existing specification and full acceptance matrix; no dependencies or migrations added.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->

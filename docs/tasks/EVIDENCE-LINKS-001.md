# EVIDENCE-LINKS-001 — Connect source evidence to explanations

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - EVIDENCE-LINKS-001 (DEV-005/006/010/016/017): Implemented and integration verified. Explicitly connect one existing published source edition to one actual owned holding or goal and a personal reason, with complete edit/review/remove/history/privacy/offline behavior. This advances the evidence-to-portfolio journey without implying automatic exposure or causation. Prompt: read existing feed/evidence/revisions and actual saved financial models; specify the user-owned connection and label it “
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **EVIDENCE-LINKS-001 (DEV-005/006/010/016/017): Implemented and integration verified.** Explicitly connect one existing published source edition to one actual owned holding or goal and a personal reason, with complete edit/review/remove/history/privacy/offline behavior. This advances the evidence-to-portfolio journey without implying automatic exposure or causation. Prompt: read existing feed/evidence/revisions and actual saved financial models; specify the user-owned connection and label it “Your research connection.” Migration024 adds owned links and immutable revisions, request idempotency/version constraints and account cascade. Strict contracts bind item ID/version/hash and target record versions; validate publication and ownership under consistent locks. Preserve minimal dated source receipts, flag changed/withdrawn source or changed/removed target for explicit review/reaffirmation; never replace the historical edition silently or republish withdrawn source text. Reader → Connect to my records → choose owned target → bounded personal reason/consent → review → save; holdings/goals link back to saved connections, evidence/history and visible loading/empty/error/retry/conflict/cancel/saved states. Do not fabricate sector/price/impact links: current OpenFIGI metadata does not establish sector classification. No fuzzy-name or automatic private-data provider queries. Reuse permitted stored Fed/ECB/PIB/WorldBank data; no additional provider or financial calculations. Implement local persisted equivalent using real bundled editions with dated notices and zero API calls, privacy export/account deletion, exact unchanged financial records, source/target change/withdrawal/reaffirm/history, foreign/stale/replay/injection/bounds cases, mobile keyboard/Back and docs. IDs API260–269/276–277, WEB260–269/276–278, OFFLINE300–309. Parent owns shared root trackers, integration/testing and gated scoped local commit; no push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EVIDENCE-LINKS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789752487631-95916.
<!-- sdlc-validation:end -->

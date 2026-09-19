# SOURCE-WITHDRAWAL-001 — Withdraw unavailable source evidence

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - SOURCE-WITHDRAWAL-001 (DEV-005/006/016, SRC-008): Implemented and selected verification passed; physical/disconnected-copy limits remain explicit. The source review found that a withdrawn item's public current/history/evidence endpoints can still disclose retained provider text, and the reader retains original/evidence CTAs. Detailed Codex prompt: read current immutable publication records and BEA's bounded public projection/locking; specify public withdrawn tombstones versus protected ret
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **SOURCE-WITHDRAWAL-001 (DEV-005/006/016, SRC-008): Implemented and selected verification passed; physical/disconnected-copy limits remain explicit.** The source review found that a withdrawn item's public current/history/evidence endpoints can still disclose retained provider text, and the reader retains original/evidence CTAs. Detailed Codex prompt: read current immutable publication records and BEA's bounded public projection/locking; specify public withdrawn tombstones versus protected retained operator evidence across every existing source. Preserve immutable internal originals and minimal IDs/editions/hashes/dates needed by private connections/reports, but redact withdrawn public source titles/body/summary/history/evidence/media and disable corresponding reader actions. Use a consistent current-publication admission under source locks so withdrawals racing history/evidence/media reads cannot admit new disclosure after commit. Preserve corrected published histories where rights allow and never delete private user notes/issued report copies implicitly. Apply equivalent bundle snapshot omission and local current/history/evidence/media behavior, explaining that an old disconnected snapshot cannot discover a later server withdrawal until replaced. Cover actual isolated publication/withdrawal/republish races, direct API bypass paths, escaped text, current reader/history/related/learning/library navigation, connection/report/inbox minimal-receipt compatibility, and offline zero-network redaction with explicit synthetic withdrawal fixtures. Reserve API370–389, WEB370–389, OFFLINE390–409; no dependency or migration unless justified. Root registers/merges shared trackers, validates actual cases and commits this correction separately; no provider call, source rights invention, private data cleanup or push. The feature must not weaken access to protected operator review or rewrite historical facts.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SOURCE-WITHDRAWAL-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789836377279-19314.
<!-- sdlc-validation:end -->

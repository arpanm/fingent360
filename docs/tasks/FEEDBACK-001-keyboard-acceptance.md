# FEEDBACK-001 — Keyboard and narrow-layout acceptance appendix

## Authoring record — 20 September 2026

E2E-WEB-1127 is authored in `tests/e2e/cases/browser/feedback-keyboard-acceptance.spec.ts` for **desktop and mobile**. It supplements the existing WEB190/191 capture and draft cases and the [context](FEEDBACK-001-context-acceptance.md) / [delivery](FEEDBACK-001-delivery-acceptance.md) appendices. It is not an executed pass or physical assistive-device certification.

After one explicit initial focus entry at Give feedback, the test uses sequential Tab and keyboard activation for screenshot choice, precise crop width, composer text, consent, submission, history details, operator inbox/review status, receipt refresh and deletion confirmation. It requires consent before Submit becomes enabled, an actual API receipt, the actual reviewed status reaching the user receipt, focus restoration after closing review and cancelling deletion, and actual capability-bound server deletion surviving reload.

Both projects run this narrow workflow at360×800. Each target control must be fully inside the viewport and win its center hit test after native keyboard navigation; the test does not forcibly scroll or focus each control to hide obstructions. Crop/composer/inbox/history must fit horizontally, without document overflow. Explicit PNG attachments are saved for those four states, with only the clean application feedback page and uniquely labelled synthetic report visible. Automatic trace/video/failure screenshots remain disabled. Operator credentials and receipt capabilities are never shown in the captured UI. The app screenshot/crop itself uses the real existing canvas capture path, not a fabricated screenshot API response.

Layer evidence: existing Dialog focus handling, Feedback/FeedbackCrop/FeedbackInbox/FeedbackAccess interfaces, contracts, actual isolated feedback API and receipt/deletion storage are reused. No new production code, migration, model/provider call, dependency or financial/account synchronization is introduced. The case uses existing fixture-owned storage cleanup. Keyboard browser correctness, screenshot review and physical assistive acceptance remain distinct.

## User-run acceptance

Prepare current PostgreSQL/MongoDB/migrations and API/web services following README (`pnpm db:up`, `pnpm db:migrate`, `pnpm dev` if required). Use the printed web URL with `/#feedback` and `/#ops`. The user invokes:

```bash
pnpm sdlc "Validate feedback keyboard acceptance" -- --project=desktop --project=mobile --grep 'E2E-WEB-1127 '
```

Tags: `@FEEDBACK-001 @TEST-SIMULATION`. Expected: both project receipts pass with real submitted/status/deletion results, then manually review the four synthetic PNGs per project for clipping, overlap, readable controls/text and visible focus. A passing containment assertion does not substitute for viewing those actual screenshots. Report the run ID, failed case/project, sanitized saved error and relevant synthetic image on failure; exclude secrets/capabilities.

Combined new FEEDBACK-001 authoring can be selected by `--grep 'E2E-WEB-112[1-7] '`. This does not replace the existing full reviewed parent matrix. No deterministic command, service action or commit was run during authoring; baseline HEAD remains `c7874a5`, with concurrent agents' changes preserved. Physical Android/iOS microphone/capture/queue/protected storage/trusted HTTPS and physical assistive-device acceptance remain external. Current user-run receipts and actual screenshot review remain pending for the newly authored browser acceptance.

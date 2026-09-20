# FEEDBACK-001 — Durable delivery and history acceptance appendix

## Authoring record — 20 September 2026

The user requested completion of remaining non-deferred work and retained the manual execution boundary. This appendix records authored acceptance for the remaining [FEEDBACK-001](FEEDBACK-001.md) destination, pause, lease, backoff and failed-history requirements in [feedback-sync.md](../development/feedback-sync.md). No test, format/check/build, service action, migration or commit was executed. Static review found no production change necessary for these cases.

Reuse the real browser queue and isolated API/storage. Successful receipts must come from actual API commits. External destination attempts must be intercepted before network access; injected failures must be labelled simulations. Do not fabricate successful receipts or shorten production lease/backoff rules to accelerate a test.

## Reviewed cases

All four cases are in `tests/e2e/cases/browser/feedback-durable-acceptance.spec.ts`, require **desktop and mobile**, and carry `@FEEDBACK-001 @TEST-SIMULATION`.

| Stable ID    | Required behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-WEB-1123 | First503 binds the actual attempted report to its original destination. Change to a blocked reserved invalid origin, explicitly check delivery and require no request there and unchanged submission. Restore the original destination, retain a real in-flight server receipt, and pause shared settings from a second actual tab. The in-flight report may become Received while a newly queued report remains unattempted. Re-enable delivery and require its actual receipt. |
| E2E-WEB-1124 | Close the first sender after the actual API commits but before its response is delivered. Read the actual persisted lease, open two tabs sharing IndexedDB, and require no second POST before expiry. Advance only browser Date, race both tabs after expiry, and require exactly one retry, identical submission/capability, original receipt time, incremented attempt count and cleared lease. No manually invented lease or receipt is inserted.                             |
| E2E-WEB-1125 | Inject only429/5xx failures. Use controlled browser time and automatic scheduled claims to require actual persisted exponential deadlines from15 seconds through the one-hour cap, no early claims, same submission identity and a deadline retained through reload. The final successful attempt goes to the real isolated API. No forced/manual retry is used to bypass the tested deadlines.                                                                                  |
| E2E-WEB-1126 | Submit to the real API, record an actual operator inbox access and refresh its receipt. Fail the next history GET with503; require the prior receipt and dated history text to remain exact, including after reload. Record a real later detail access, recover the GET and require both recorded accesses with a nondecreasing checkedAt. Also tagged `@DEV-017`.                                                                                                               |

## Layer and boundary review

- Specification/workflow: destination binding, truthful pause semantics, persisted lease exclusivity, idempotent recovery, capped automatic retry and retained prior support history reuse the existing product policy.
- UI/UX: actual settings, composer, history details and Check delivery are exercised. In-flight manual retry makes its page busy; the pause case therefore uses a second actual tab, as the shared-settings policy permits. These cases do not claim full keyboard, narrow-layout or physical assistive acceptance.
- API/contracts: all successful writes and receipt refreshes use real application endpoints. The lease case compares the original committed receipt with the recovered idempotent receipt. Simulated status responses are explicitly marked and do not count as successful delivery.
- Database: browser IndexedDB persists real submitted records/leases/deadlines; server records use the existing fixture-owned PostgreSQL/MongoDB lifecycle. Tests read only their uniquely labelled local record, and existing fixture teardown removes only its owned server resources. No schema or migration change.
- Data/security: no provider call, account synchronization or real personal feedback. Capability-bearing tracing, screenshots and video remain disabled. The reserved alternate origin is blocked in the route handler and never contacted. Real API success is never synthesized.
- Automation: time changes are browser-owned only; server clocks and stored data are not rewritten. Existing worker/sync APIs are not weakened. Only a later user-selected test execution starts fixture services.
- Offline: existing OFFLINE230–235 cases remain required for packaged storage and concurrent deletion/reversed receipt behavior. These cases add connected real-server evidence and shared browser IndexedDB recovery, not native queue certification.
- Documentation: combine this appendix with [submitted context acceptance](FEEDBACK-001-context-acceptance.md). Existing stable cases remain in the parent matrix; these are additive requirements.

## Manual handoff

No dependencies changed. Prepare configured PostgreSQL/MongoDB, current migrations and API/web services using the repository README (`pnpm db:up`, `pnpm db:migrate`, `pnpm dev` when required). Use the printed web URL with `/#feedback`. The launcher does not start those services or apply migrations.

```bash
pnpm sdlc "Validate durable feedback acceptance" -- --project=desktop --project=mobile --grep 'E2E-WEB-112[3-6] '
```

Expected: all four cases pass in both projects with actual receipts and the specified retained-state assertions. For combined newly authored context plus delivery coverage, use `--grep 'E2E-WEB-112[1-6] '`. The launcher owns format/check, gated commit and selected E2E; watch mode remains off. Report the saved run ID/date, selected cases/projects, report path and sanitized error on failure; do not include capability tokens or connection secrets.

Authoring baseline: `c7874a5`. These dedicated files remain uncommitted; other agents' changes are preserved. No validation result is inferred from static review. Successful current receipts are still required before these automated gaps can close. The parent retains physical Android/iOS microphone/capture/storage/HTTPS gates and separate comprehensive keyboard/mobile/visual acceptance; no full parent completion is claimed.

# DEV-017 — MFA and private-history browser acceptance appendix

Status: Authoring; no execution or pass claims.2026-09-20, isolated base c7874a5. This appendix closes only independently actionable supported-browser coverage; production keys/historical rollout, operational security, broker activation and physical native gates remain in DEV-017.

## Specification before implementation

Reuse WEB1400's actual enrollment, API1402's actual disable/recovery step-up, WEB1254's encrypted history store and WEB1116's separate consent boundary. Add actual keyboard traversal/activation,360px containment and credential-masked synthetic screenshots for MFA settings status error/reload, enrollment/confirmation, replayed-code refusal, disable/reload and recovery-code rotation/password reset. Use actual account/MFA APIs and synthetic owned accounts; never mock success or reset security counters. Secrets/codes/passwords must not enter traces, videos, screenshots or assertion diagnostics. Accept codes within the server's documented current/adjacent30second window; do not wait for wall-clock rollover or mutate MFA replay state to force acceptance.

Private-history controls must exercise explicit history-purpose grant separately from external private-context sharing, actual encrypted retained synthetic records, load/details/export, ordinary refresh/export/delete failures and recovery, deletion and consent revocation. Ordinary failures preserve the previous successful result with a visible loaded-at timestamp. Unauthorized responses clear decrypted content and disable stale controls; late history/export responses after unmount or session invalidation cannot restore content or start downloads. Use real API responses; transport faults may abort/hold actual requests, never fulfill invented successes. Source/provider integration is already separately covered by API1118–1120; synthetic retention fixtures do not certify an actual model.

Confirmed product issue: PrivateAiHistory currently only sets error on401 and retains decrypted rows; its download has no unmount/session guard. Parent approved ownership of PrivateAiHistory.tsx for a minimal denial-clear and generation/liveness guard, preserving ordinary-failure snapshots. Public contracts/data model unchanged, no migrations or dependencies. UI/UX/API/storage/automation covered by the actual workflows above; offline/local hardware vault and physical authenticator certification remain separate. Root owns manifest/catalogue/parent tracker integration.

## Authored implementation and cases

`PrivateAiHistory.tsx` clears decrypted state, loaded-at timestamp and download notice on live401 or session-change invalidation. A generation/liveness guard suppresses stale responses and blocks starting a download after unmount/invalidation. Explicit Reload privacy page performs a fresh account/session check. Ordinary transport errors retain the prior result and visibly state its last loaded time. No public API or storage behavior changed.

New desktop/mobile cases (authored, not executed):

- WEB1403: initial real status transport failure/reload; keyboard enrollment/confirmation; replayed authenticator code rejection and cleared sensitive fields; fresh accepted-window code disables; reload confirms durable disabled state; masked360px screenshot.
- WEB1404: enabled account cannot rotate recovery code without MFA; keyboard step-up/rotation, hide one-time code, masked narrow screenshot, actual saved-code password reset with mismatch recovery, original session denied and password-only UI login proves MFA reset. Codes use the server's documented current/next accepted30second window to avoid waiting for rollover; no clock/counter/security-state mutation.
- WEB1405: keyboard explicit history grant while private-context sharing remains not-granted; actual encrypted synthetic history load/details, dated state after failed refresh, failed export then downloaded schema-validated own history, failed delete then actual durable deletion, recreated history then keyboard revocation and reload; narrow screenshot after private history removal.
- WEB1406: real server logout invalidates the copied browser session; actual401 from history clears decrypted entries/timestamp/export controls; explicit page reload shows sign-in gate.
- WEB1407: hold a real authorized history response for export, navigate away, release it and verify no download or rehydration after returning. No invented successful response.

History fixture uses actual start/finish functions in an owned database transaction, encrypted storage and separately granted consent; synthetic text only. It does not claim configured-provider dispatch (covered separately by API1120). Automatic trace/video/screenshot disabled for these credential workflows; only explicitly masked synthetic regions are attached after secrets/history are hidden. No private user data is used.

Owned files: `apps/web/src/PrivateAiHistory.tsx`; new `tests/e2e/helpers/privacy-management.ts`; new `tests/e2e/cases/browser/privacy-mfa-management.spec.ts`; new `tests/e2e/cases/browser/privacy-history-management.spec.ts`; this appendix. Root owns the DEV-017 link, acceptance/CATALOG/coverage and shared tracker changes. Keep every rollout/operational/broker/physical gate; only supported MFA/private-history UI coverage becomes author-complete pending saved validation. Other feedback child work remains independent.

## Manual handoff

After parent integrates reviewed authoring, the user runs:

```sh
pnpm sdlc "Complete supported privacy keyboard and recovery acceptance" -- --grep 'E2E-(WEB-(1400|1403|1404|1405|1406|1407|1254|1116)|API-1402)'
```

Required existing services: owned PostgreSQL/Mongo, configured API and web. No new dependency/migration/install step. Open the launcher web URL → Privacy and sessions (latest saved web http://127.0.0.1:5176, API http://127.0.0.1:4104). Browser cases require desktop and mobile projects; API1402 remains api. Normal SDLC owns format/check/gated commit and selected acceptance. Expect real error recovery, no unauthorized/stale private disclosure, readable narrow controls and masked synthetic screenshot attachments. Physical authenticator/native security is not certified by these browser cases.

On failure report run ID, exact case/project, assertion and artifact path. Traces are intentionally off to avoid storing codes/passwords; describe UI state without secrets and use only the masked synthetic attachments. No commands were run for format/check/build/tests/services, no browser automation was executed and no commit made. Base c7874a5; the isolated worktree also contains collaborators' unrelated authored changes, preserved for parent review. No automatic validation or watcher was started.

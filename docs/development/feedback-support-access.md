# Feedback support access — DEV-017

Authored 2026-09-15; validation not run. This closes a concrete private-feedback read gap, not the complete security programme.

## Behavior

Named administrators can read the feedback inbox and full submitted reports. Viewer, researcher and publisher roles receive 403; bootstrap administration remains compatible. Status/deletion permissions are unchanged. Each successful read records its action, report version, pseudonymous administrator identifier and date in the existing feedback audit, in the same transaction as read admission. No content is returned if the audit fails. Existing session/identity version and expiry checks are repeated under transaction locks. GET responses are private/no-store.

The original receipt-token holder receives `supportAccess` on the existing report GET: total count, latest twenty dated inbox/detail access events and check time. No operator identity/token is exposed. The native Android transport already supports this route; no new bridge permission or server address is required. Existing report deletion/expiration blocks this history route as well. Historical pre-deployment reads cannot be reconstructed.

My feedback → View attachments & details now shows Support access history. Check delivery refreshes it; a dated copy survives offline/reload. An absent field means unchecked/older server, never zero accesses. Failed refresh retains the last dated result. The text distinguishes authorized server delivery from a person actually reading it.

## Specification/layers

- Contracts: optional backward-compatible receipt history; strict event schema, maximum twenty events.
- Database: existing feedback_audit stores minimal access metadata; migration058 adds a partial history index. No new PII column, destructive backfill or runtime grant is needed.
- API: administrator read admission, same-transaction audit, receipt-capability history.
- UI/UX: dated saved, unknown, empty, populated and retry through existing delivery states; keyboard-native buttons and responsive existing details.
- App/offline: existing native receipt GET and local storage carry history; installed APK needs rebuild/reinstall. No private server access exists in fully offline mode.
- Real data: real submitted reports and actual support reads. Tests use explicitly synthetic feedback, never real holdings or screenshots.
- Automation: existing user-enabled delivery/receipt transport; no background support reads or new provider call.

## Research and inputs

No private user input needed. Existing named-admin permission and receipt-capability product decisions are reused. PostgreSQL's documented `FOR SHARE` behavior blocks update/delete of locked rows through transaction completion; session and identity checks use this property. [Primary PostgreSQL documentation](https://www.postgresql.org/docs/16/explicit-locking.html). This is a technical control, not a legal/privacy certification or consent to wider support access.

## User-operated validation

No dependencies changed. Use existing local PostgreSQL/MongoDB services and configured API/web. Apply migration with `pnpm db:migrate` if upgrading the local deployment; tests' isolated API fixture applies migrations itself. Then:

```sh
pnpm sdlc "Audit feedback support access" -- --grep DEV-017
```

Authored E2E-API-1251 (admin/read roles, receipt secrecy, history, deletion),1252 (signed-out denial),1253 (actual database audit failure; synthetic fault injection), and E2E-WEB-1251 (actual support read, refresh, mobile/desktop saved-offline display). Browser cases need the web URL printed by `pnpm dev`, then `/#feedback`; leave test UI watch/eye mode off. Report failing ID/project, saved run path and redacted error; never include receipt tokens/private report bodies.

Manual Android acceptance: rebuild/reinstall using existing Android packaging instructions; send synthetic feedback through configured API, open it as administrator, Check delivery, inspect history, disconnect, reopen and confirm the last-check date stays visible. With delivery disabled, no new history is claimed. Keyboard/mobile visual acceptance remains user-run.

## Remaining DEV-017 gaps

PII encryption and key lifecycle/rotation; broader production retention/MFA/abuse controls; remaining untrusted-document/injection acceptance; broker token vault only when real broker connection scope is selected. The application audit is not a tamper-proof external audit service; a database owner still controls the database. Full parent remains Partial.

## Encryption completion for submitted feedback — 2026-09-15

New reports now encrypt text, context, screenshot and voice payloads before persistence using the shared server key ring. Receipt/status and a public source ID stay queryable; receipt-token hashes remain authentication metadata. Migration063 adds ciphertext/public-source fields and enforces that encrypted rows cannot retain duplicate plaintext. Owner reads and authorized support reads decrypt and rotate/upgrade legacy rows transactionally. Delete, expiry and retention erase ciphertext too. A missing key holds new feedback on the user's device via the existing retry state; invalid ciphertext never falls back to plaintext.

Operations → Feedback inbox → Protect retained feedback provides confirmed batches of up to fifty active legacy/old-key reports. Results are counts only, with a minimal maintenance audit; every next batch is another deliberate user action. Keep old keys until the remainder is zero or rows expire, and account for older backups separately. No maintenance/backfill was executed by the agent.

Evaluation detail/evidence now require administrator access because they can include submitted feedback; evaluation feedback reads use the same successful-access audit and decrypt only after admission. Public source linkage uses its separate non-private source-ID column. Other operator list metadata remains accessible under its existing role policy.

Additional authored cases: API1256 encryption/wrong-key/deletion, API1257 confirmed legacy batch, WEB1256 maintenance confirmation/count states. Existing screenshot/voice roundtrip cases continue to exercise actual attachment validation and receipt behavior. Explicit native/offline acceptance remains user-operated: missing key/network leaves a local retryable report; after keys/network return, delivery remains idempotent.

Configure `PRIVATE_DATA_KEYS` and `PRIVATE_DATA_ACTIVE_KEY` before accepting server feedback (see private-history-encryption.md); no keys were written or generated for the real local app. Apply migrations via user-run `pnpm db:migrate`, then `pnpm sdlc "Encrypt submitted feedback" -- --grep 'DEV-017|FEEDBACK-001|EVAL-LINEAGE-001'`. This scope adds no dependencies and does not encrypt every unrelated private domain.

# Private AI history encryption — DEV-017

Authored 2026-09-15; no execution/activation claimed. The server encrypts opted-in AI instructions, input and raw/validated output before new history writes. AES-256-GCM uses a random 12-byte nonce, 16-byte authentication tag and owner/record-bound additional data. The envelope contains only version, key ID, nonce, tag and ciphertext. The corresponding plaintext columns are emptied. Existing owner-only APIs decrypt for authorized display/export; deletion and consent revocation still work without decryption keys.

Migration061 is additive. Existing plaintext rows are upgraded transactionally when their owner loads/exports history or a pending provider result finishes. They remain plaintext until that access or normal seven-day expiry; old database backups are not rewritten. This deliberately does not claim all historical PII has already been encrypted.

## Server configuration and rotation

Set `PRIVATE_DATA_ACTIVE_KEY` to a short version label and `PRIVATE_DATA_KEYS` to JSON mapping labels to independently generated 32-byte base64 keys in ignored `.env` or the deployment secret manager. `.env.example` contains variable descriptions only. Keep secrets out of browser variables, logs, screenshots, commits and feedback. No new dependency is needed. The test fixture generates an ephemeral isolated key; it never uses production keys.

This document originally covered only opted-in private history. The subsequent feedback, MFA and private financial storage implementations also require this server key ring; see [private financial storage](private-financial-storage.md) and [authenticator](account-authenticator.md). Within the history feature, only opted-in retention depends on keys. With missing keys, saving such history fails closed (provider assistance can use its existing query fallback); existing encrypted history returns a safe unavailable error. No key is guessed from database credentials. A bad/missing decryption key or modified ciphertext never falls back to plaintext columns. Empty history, normal queries, deletion and opted-out accounts remain available.

To rotate, add a newly generated key under a new ID while retaining the old entries, switch the active ID and restart the API using the normal user-owned workflow. New writes use the new ID. Owner reads/exports rewrap old-key rows under the active key. Keep previous keys until retained records have upgraded/expired; coordinate backup retention separately. Removing a needed key causes an explicit unavailable response, not deletion. This is local server key management; external KMS, automatic key provisioning and all-account bulk rewrapping are not claimed.

## UI/app/data boundary

Privacy → My AI request history retains Load, expandable request details, Download, Delete and error/retry controls. UI text explains server encryption and readable downloads. Android connected mode uses these same account APIs. Server keys do not enter the APK. Device-only mode does not have remote provider history and does not claim this encryption for its local files. Existing consent and account export/deletion contracts remain unchanged; no new personal input is needed.

## Authored acceptance

- E2E-API-1254: actual legacy row → owner API → emptied plaintext/ciphertext; owner/record AAD mismatch rejection; changed-key rewrap and unknown-key API503; new-write/output encryption; missing key rejection.
- E2E-WEB-1254: actual encrypted record → owner Privacy screen → expand/read → delete and database absence, desktop/mobile.
- E2E-API-1115 updated to pass the isolated synthetic key configuration; original consent/isolation/revocation expectations retained.
- Manual native acceptance: rebuild/reinstall, connected owner loads/exports history; missing-network retry remains truthful; no server key appears in device config. Visual/keyboard/device acceptance is not inferred from API cases.

Existing services: local PostgreSQL/MongoDB and configured web/API. Apply `pnpm db:migrate` for the normal local deployment, configure ignored server keys before connected encrypted features are used, then user runs:

```sh
pnpm sdlc "Encrypt private AI history and audit support access" -- --grep 'DEV-017|E2E-API-1115'
```

Use the web URL printed by `pnpm dev` with `/#privacy`. Keep watch/eye mode off. Report failed ID/project/run path and redacted error; never include private history or key values. No agent-run format/check/build/test/migration/commit occurred. Parent DEV-017 remains Partial: other profile/goal/holding/feedback PII encryption, broader key lifecycle/KMS, MFA, production abuse/injection and retention acceptance remain separate.

## Primary research

[Node.js crypto documentation](https://nodejs.org/api/crypto.html) documents unique unpredictable IVs, GCM authentication tags and `setAAD`/`setAuthTag`. The implementation uses those APIs and rejects any authentication failure before returning plaintext. This is engineering evidence, not a privacy certification or broader regulated-product approval.

# Angel One publisher connection

DEV-028 third gated pathway, authored 2026-09-15. Not activated or validated. This implementation supports only an eligible registered Publisher app; it never falls back to broker PIN/password/TOTP collection.

## Workflow and acceptance

The signed-in owner consents in Holdings and opens the fixed publisher-login destination with registered redirect and one-time state. The callback receives auth_token/state; optional feed_token is discarded. GET renders explicit completion without validating or storing a token. Same-origin completion POST requires the initiating account, consumes pending state, validates the token through the broker profile endpoint, then rechecks the account before storing an encrypted vault. Profile name/contact fields are discarded; only the required broker account ID is retained inside the token envelope for logout. Callback credentials are never audit payloads or exports.

A user-requested capture reads getHolding and applies a strict versioned parser. It accepts only settled DELIVERY NSE/BSE rows, matching realised quantity, zero T1 and no collateral. Unknown fields, duplicates, unsupported precision and missing cost are refused. Numeric JSON lexemes remain decimal strings; exact integer quantity×average-price arithmetic rounds half-up per row to paise. Saved receipts clearly identify unverified broker-average-price cost, never tax/tradebook reconciliation or market valuation. The existing import preview reconciles current holdings/dependencies and requires separate explicit confirmation.

Migration089 stores owner-bound encrypted tokens/raw captures, public source hash/times and restricted action audit metadata. Caps limit starts to20/day and retained captures to100/account. Status scrubs expired token/state capabilities; local expiry uses the next midnight IST boundary and the provider remains authoritative for earlier invalidation. No token refresh is attempted. Revoke first destroys local capability and invalidates pending previews, then calls broker logout; remote failure is explicit and directs the user to broker API session management/expiry. Confirmed holdings remain until separately removed. Capture export excludes tokens; capture deletion/account deletion remove owned broker records. Current encryption keys rewrap older envelopes on admitted reads.

The shared web/connected Android Holdings UI covers status loading, configuration-unavailable, retry, consent, login, returned authorization, preview, confirmation, revoke/export/delete and error recovery. `fingent360://broker-angel` accepts only bounded state/auth_token, clears Intent data, retains it in memory for at most ten minutes and delivers once to the trusted main-frame bridge. Completion still requires the initiating server account. Custom schemes do not imply exclusive ownership. Native handlers never navigate/evaluate supplied URI content. Device-only mode denies broker operations without queuing credentials/provider requests; existing file import remains available.

## Primary research and activation inputs

- [Official User documentation](https://smartapi.angelone.in/docs/User): publisher-login/state echo, profile and logout schemas, session lifecycle; indexed content reviewed2026-09-15 (direct page sometimes returns access denied).
- [Official Python SDK](https://github.com/angel-one/smartapi-python/blob/main/SmartApi/smartConnect.py): current fixed API root, publisher URL, header names and profile/holdings/logout endpoints. SDK logging/hardcoded fallback network values are not copied.
- [Official holdings announcement](https://smartapi.angelone.in/smartapi/forum/topic/4006/new-fields-added-to-getholding-endpoint-and-introduction-of-getallholding-endpoint/4): holdings fields including P&L percentage; reviewed2026-09-15.
- [Angel One introduction](https://www.angelone.in/news/research/how-to-use-angel-brokings-smartapi): distinguishes Publisher and Trading app categories; older product guidance, not current eligibility approval.
- [Public new-login incompatibility discussion](https://smartapi.angelone.in/smartapi/forum/topic/5516/redirect-issue/11?lang=en-GB): users report publisher redirects unsupported for new-login apps. This is a compatibility warning, not authoritative permission or proof all publisher apps work.

Operator needs explicit publisher-app eligibility plus profile/holdings retention/deployment permission before activation. Configure server-only ANGEL_API_KEY, ANGEL_REDIRECT_URL, ANGEL_PERMISSION_REFERENCE, ANGEL_CLIENT_LOCAL_IP, ANGEL_CLIENT_PUBLIC_IP and ANGEL_MAC_ADDRESS, then ANGEL_ENABLED=true. Supply truthful deployment network identity values; no fabricated values or external IP-discovery service is used. The callback path is exactly `/api/v1/account/broker-connections/angel/callback`, HTTPS except loopback development. App operation restriction is not a claim that broker tokens themselves are read-only. No orders, feeds, refresh or password endpoints exist here.

The permission reference must cover actual publisher eligibility and this application's retained holdings/profile verification use. No provider approval or current account entitlement has been inferred from publicly readable documentation. Keep callback query strings, Authorization headers and broker payloads out of reverse-proxy logs. Rebuild/reinstall the APK for changed native/bundled web code.

## Authored tests and user-run next actions

API1490–1496 author actual encrypted persistence/import confirmation/private export, revocation, strict parser, disabled configuration, wrong-owner/signed-out callback rejection, unused-feed discard, cancellation/expiry and network metadata/app-key guards. WEB1490–1491 use an explicitly synthetic provider boundary and actual app API; native bridge simulation is not physical APK acceptance. OFFLINE1490 asserts denial and zero broker requests.

No dependencies changed. No tests/checks/builds/migrations/services or commit were run. User configures private keys, starts PostgreSQL, runs `pnpm db:migrate` and `pnpm dev`, then opens its printed URL at `#holdings` and invokes:

```bash
pnpm sdlc "Add gated Angel One publisher connection" --grep 'E2E-(API-149[0-6]|WEB-149[01])'
pnpm android:web
pnpm android:test --grep E2E-OFFLINE-1490
pnpm android:build
```

Keep watch/eye mode off. Test physical app return, cancellation, focus/keyboard/touch and approved live publisher activation separately. Expected result: holdings change only after explicit review; inaccessible/expired/revoked/ambiguous capture preserves prior holdings; private credentials never appear in exports. On failure provide selected IDs/project/run time and redacted error artifacts, not broker codes/tokens.

DEV-028 remains partial for Groww/ICICI/registrar/CAS/eligible Account Aggregator paths. Groww's [official guide](https://groww.in/trade-api/docs/curl) currently documents manually managed tokens or user key/secret/TOTP flows, not delegated browser state; no credential-collection fallback is authored. ICICI's [Breeze reference](https://api.icicidirect.com/breezeapi/documents/index.html) documents browser API_Session but no state-echo contract; safe multi-user correlation needs provider evidence. These are specific pending integration inputs, distinct from the implemented connectors' activation/validation.

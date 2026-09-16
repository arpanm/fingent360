# Upstox connection and reviewed holdings import

DEV-028 second supported pathway, authored 2026-09-15. No live brokerage call, provider approval, activated account or test pass is claimed.

## Specification and workflow

A signed-in customer consents in Holdings, then opens Upstox's OAuth2 authorization dialog. The registered API callback receives code/state and displays an explicit same-origin completion form. GET never exchanges a token or changes connection state. Completion verifies the initiating Fingent360 account before exchange and re-admits it before committing. State is random, hashed, single-use and expires in ten minutes. Denied authorization has a safe return/cancellation flow; stale or replaced state cannot cancel another connection.

Only authorization-code exchange, GET long-term holdings and DELETE logout exist. This limits what this application does; it does not claim that the broker token has read-only privileges. There is no trading, password/OTP collection, automatic polling, refresh flow or assumed extended-token entitlement. Every capture needs explicit storage consent. Server credentials/permission references never enter customer forms or APK configuration.

The v1 parser accepts settled delivery (D) NSE/BSE equity rows with matching exchange/instrument-token/ISIN and matching deprecated symbol alias if supplied. It refuses used, T1, pledged/collateral, MTF, duplicate, unknown-field and ambiguous rows. Numeric JSON lexemes remain strings before any arithmetic. Quantity multiplied by average price uses integer arithmetic with per-row half-up paise rounding; receipt labels this broker average-price cost as unverified, not tax or tradebook cost. Quoted last price/P&L is retained as evidence but never silently becomes valuation. Existing holdings reconciliation presents removals/dependencies and requires a separate explicit confirmation.

Migration086 stores owner-bound encrypted token envelopes and encrypted raw/normalized captures (100 retained captures maximum per account). Status reads remove expired capabilities; token expiry is the next03:30 IST, including the same morning for an issuance before03:30. Vault and capture reads use the current encryption keyring and rewrap older keys. Revoke destroys the local token first, invalidates unconfirmed broker previews, and attempts remote logout. Only a successful broker response confirms remote invalidation; otherwise the user is directed to Upstox logout. Confirmed holdings remain until deleted through Holdings. Export includes raw/normalized captures and audit metadata without access tokens/secrets. Broker deletion removes capture history; account deletion cascades it. Backup retention follows deployment policy.

## Web, Android and offline behavior

The Holdings component provides loading, unavailable/retry, consent, authorization link, pending/expired/reconnect, capture review, revoke, export and delete states. It shares the actual import confirmation flow on web and connected Android. The callback offers `fingent360://broker-upstox` handback; native code accepts only the fixed scheme/host and one bounded state/code pair, clears Intent data, keeps values in memory for ten minutes, and delivers once to the trusted main-frame bridge. It never evaluates supplied JavaScript or navigates a supplied URI. The customer explicitly completes in the signed-in WebView; server owner checks remain mandatory. A custom scheme is not exclusive app ownership. Physical handback/keyboard/touch acceptance is separate from browser simulation.

Device-only mode refuses every broker endpoint and offers file imports. It does not queue OAuth credentials or attempt provider calls. Rebuild/reinstall the APK to include changed bundled web/native code; an installed APK does not update simply because source files changed.

## Primary research and required activation

Reviewed 2026-09-15:

- [Authentication](https://upstox.com/developer/api-documentation/authentication/): OAuth2 authorization code, exact redirect URI and state echo; code is single-use.
- [Token exchange](https://upstox.com/developer/api-documentation/get-token/): documented top-level token response and expiry at03:30 IST.
- [Holdings](https://upstox.com/developer/api-documentation/get-holdings/): long-term holdings schema, symbol alias, quantities and average price.
- [Logout](https://upstox.com/developer/api-documentation/logout/): DELETE logout endpoint and successful boolean receipt.
- [Terms/privacy](https://upstox.com/terms-of-use-and-privacy-policy/): general website/privacy information, not evidence of this deployment's API retention rights.
- [Official Uplink introduction](https://upstox.com/market-talk/introducing-uplink-api-version-2/): public free-API guidance; this does not establish all current entitlements or retention permission.

Operator must register the app/redirect and privately configure `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URL`, and a deployment/retention permission record in `UPSTOX_PERMISSION_REFERENCE`; only then enable `UPSTOX_ENABLED=true`. Callback path is exactly `/api/v1/account/broker-connections/upstox/callback`; HTTPS except loopback development. Configure payload/identity keys before account use. No credentials, provider approval or permission has been supplied by this implementation. Keep callback queries, token forms and Authorization headers out of reverse-proxy/application logs. General public access or a free API article is not a retention license.

## Authored acceptance and manual execution

No dependency changes. No commands, tests, migrations, builds, services or commits were run by the agent. API1450–1456 cover actual owner-bound persistence/import/export, revocation/deletion, unsupported rows, disabled activation, callback ownership, cancellation/expiry and exact arithmetic. WEB1450–1451 cover the actual connected import flow and a labelled synthetic native handback; OFFLINE1450 covers denial with zero provider requests. Fixtures substitute only the provider boundary; they do not use real customer holdings or credentials.

User prepares private keys/configuration, starts PostgreSQL and runs `pnpm db:migrate`, then `pnpm dev` (use its printed URL, open `#holdings`). Run the scoped checks/gated commit/E2E workflow:

```bash
pnpm sdlc "Add gated Upstox holdings connection" --grep 'E2E-(API-145[0-6]|WEB-145[01])'
```

Separate packaged offline and physical Android acceptance:

```bash
pnpm android:web
pnpm android:test --grep E2E-OFFLINE-1450
pnpm android:build
```

Use the printed APK artifact path. Keep watch/eye mode off. Expected outcomes: no holdings change before confirmation; paise reconciliation matches capture; wrong-owner callback cannot exchange; revoke/delete removes capabilities; offline never opens provider calls. Report selected IDs/projects, run time and redacted error artifacts on failure, never callback codes or credentials.

Parent DEV-028 remains partial: Groww, Angel One, ICICI Direct, registrar/CAS and eligible Account Aggregator connectivity are separate implementations/activation decisions. DEV-008 broker CSV-format verification remains distinct from these API schemas.

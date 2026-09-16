# Zerodha connection and reviewed holdings import

DEV-028 first supported pathway, authored 2026-09-15. No live brokerage call, approval, test pass or activated account is claimed.

The connector uses Kite's custom login/request-token/checksum flow. After signing in on Zerodha, the API callback presents a same-origin confirmation page. Its explicit POST requires the same signed-in Fingent360 account that initiated the one-time state, then rechecks that account before saving the encrypted token. This protects against a login URL created by another account. No broker password/OTP is collected by Fingent360. Browser/Android users return to Holdings and refresh status after completion; disconnected mode offers the existing file import instead.

Only token exchange, GET holdings and token revocation endpoints exist. This is an application operation restriction: ordinary broker tokens may permit trading operations elsewhere. There is no API scope assertion, trading path, refresh-token entitlement or background broker polling. Every holdings read requires a user action and current connection consent. End-user UI has no server key or permission fields.

Supported import rows are unambiguous settled CNC Indian-equity holdings. T1, sold/used, collateral, short, MTF, discrepant, duplicate ISIN, unknown fields and unsupported precision cause refusal, preserving current holdings. Average-price source lexemes remain decimal strings; quantity × average price is calculated in integers and rounded half-up per row to paise. The receipt explicitly marks broker-average-price cost as unverified, rather than claiming tradebook/tax reconciliation. Price/P&L fields never become market valuations. A capture produces the existing removal/dependency review and only explicit confirmation changes saved holdings.

Migration083 stores encrypted tokens and encrypted raw holdings/normalized captures, bounded to100 captures per owner; metadata supports expiry, owner admission, deduplication and audit. Revoke immediately clears local tokens and pending authorization and invalidates pending broker previews, then attempts remote token invalidation. If remote invalidation fails or keys are unavailable, the UI directs the user to Kite logout. Confirmed holdings remain under their own deletion policy. Export includes raw holdings and normalized receipts but never tokens/API secrets. Delete broker captures removes this connection/history; account deletion cascades all owned broker data. API status reads scrub expired tokens. Server backup retention still requires operational rollout decisions.

## Primary evidence and activation inputs

- [Kite user API](https://kite.trade/docs/connect/v3/user/): login, request-token checksum, redirect_params, normal session expiry and revocation; reviewed2026-09-15.
- [Kite portfolio API](https://kite.trade/docs/connect/v3/portfolio/): long-term holdings, ISIN/quantity/average-price fields and settlement ambiguity; reviewed2026-09-15.
- [Kite terms](https://kite.trade/terms/): end-user platform approval, confidentiality, retained-copy restrictions and audit obligations; reviewed2026-09-15. This implementation does not assert that permission has been granted.
- [Zerodha plan guidance](https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/historical-data-and-live-market-data-payment-plan): Personal includes holdings; market-data entitlement is separate. No paid subscription is purchased by this work.

Operator supplies server-only KITE_API_KEY, KITE_API_SECRET, KITE_REDIRECT_URL and KITE_PERMISSION_REFERENCE privately; KITE_ENABLED defaultsfalse. The registered redirect is exactly `/api/v1/account/broker-connections/kite/callback` on the configured API origin; HTTPS is required except loopback development. Permission reference must cover this deployment and encrypted holdings retention, not merely public docs. Configure customer identity/payload keys before activation. Never log callback query strings, token-exchange bodies or broker Authorization headers in an external reverse proxy. Do not put secrets in README, APK, browser configuration or feedback.

## Manual acceptance

No dependencies changed. User runs key setup, `pnpm db:migrate`, API/web startup and:

```bash
pnpm sdlc "Add gated Zerodha holdings connection" --grep 'E2E-(API-142[0-6]|WEB-142[01])'
```

For the separate packaged offline project, the user runs:

```bash
pnpm android:web
pnpm android:test --grep E2E-OFFLINE-1420
pnpm android:build
```

Install the APK produced by the final command for physical handback testing; use the printed artifact path. A source edit does not replace an already installed APK.

API1420–1426 and WEB1420–1421 use a labelled synthetic external provider boundary with actual Nest/API, encrypted database persistence and confirmation. OFFLINE1420 asserts explicit denial and no provider network traffic. Watch/eye mode stays off. Check mobile focus/touch, cancellation and return-to-app on the rebuilt APK separately. Live acceptance needs the privately configured registered app and rights evidence. Record selected IDs, project, run time and redacted failure artifacts; never share callback tokens or credentials.

DEV-028 remains partial: other brokers, CAS/registrar and eligible Account Aggregator pathways need their own approved formats/access and implementations. DEV-008 CSV dialect verification is not completed by this separate API connector.

Android return: the callback page offers `fingent360://broker-kite` handback. The native handler accepts only the fixed scheme/host and exactly one bounded state/request-token pair, clears Intent data, retains it only in memory for at most10 minutes, and delivers once through the trusted main-frame bridge. It never navigates to a supplied URL or evaluates supplied JavaScript. The user explicitly completes authorization in the signed-in WebView; the server still verifies the initiating owner. A custom scheme is not exclusive app ownership, and no such claim is made. Revoke/cancel invalidates server state; reload loses the consumed UI callback. Physical Android acceptance must verify this external-browser return and session preservation on the rebuilt APK.

Incomplete/denied callback pages provide a safe return and an explicit signed-in cancellation form; GET performs no mutation. Owner-bound cancellation cannot cancel a replaced connection. Pending expiry clears the saved state capability on status read and displays reconnectable expiry. API1425 authors incomplete callback, cancellation, replaced-state refusal and actual expiry cleanup. Remote revocation is called confirmed only after a successful broker response with true data; otherwise local-only revocation is explicit.

API1426 authors refusal of an old vault after the configured Kite app key changes, before any provider network request. Revoke can still invalidate the originally issued token using its original app key.

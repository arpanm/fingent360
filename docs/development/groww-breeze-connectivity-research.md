# Groww and ICICI Direct connection readiness

Research date: 2026-09-15. This is a protocol/input assessment, not an implemented connector or live-provider acceptance. DEV-028 and SRC-021 remain partial. No credentials, provider login, API activation or account data were requested or used.

## Groww

The [official cURL authentication reference](https://groww.in/trade-api/docs/curl) describes a personal account's manually generated bearer token, API-key/secret approval and TOTP alternatives. It requires an active Trading API subscription and says manually generated tokens expire daily at 06:00 without specifying a timezone on that page. This is insufficient to invent a delegated authorization redirect or a precise server expiry calculation.

The [official profile endpoint](https://groww.in/trade-api/docs/curl/user) exposes a stable vendor user identifier and UCC. The [holdings endpoint](https://groww.in/trade-api/docs/curl/portfolio) documents DEMAT quantities, average price and several locked/pending components. These provide useful identity and reconciliation inputs after valid authorization; token possession and a matching profile do not establish this deployment's permission to receive customers' personal API tokens. The sample contains locked and pending quantities and must not be treated as an already reconciled settled-equity fixture.

There is positive evidence of a partner pathway: Groww's [AlgoTest integration article](https://groww.in/blog/trade-on-algo-test-using-groww) describes OAuth2 and portfolio access; its [SDK introduction](https://groww.in/trade-api/docs/python-sdk) also mentions OAuth2. Therefore this research does **not** conclude that Groww lacks OAuth. The public pages inspected do not provide the delegated protocol needed to implement it: authorization endpoint, client registration, exact redirect matching, state echo or another documented anti-substitution mechanism, token exchange, scopes, expiry timezone and revocation. Third-party descriptions of token endpoints are not substitutes for that contract.

## ICICI Direct Breeze

The [official API reference](https://api.icicidirect.com/breezeapi/documents/index.html) specifies registered AppKey/secret and redirect URL, login returning API_Session, CustomerDetails exchange and signed holdings reads. It binds subsequent request checksums to timestamp, exact JSON body and secret. CustomerDetails returns the provider account identity. These are concrete documented account-session operations, not proof of an OAuth authorization-code flow.

The inspected login URL accepts AppKey; the documentation does not establish a caller-controlled state echo, PKCE or an equivalent one-time owner-bound callback mechanism. Callback handling also needs clarification: the API reference describes an address-bar return while the [official session article](https://www.icicidirect.com/ilearn/stocks/articles/how-to-generate-session-key-and-install-sdk-for-breeze-api) describes a form-post return. No implementation may match a received session to the latest pending user, rely on a shared browser cookie alone, or infer identity by merely decoding a session token. App registration alone does not establish third-party multi-user access and retention entitlement.

## Concrete input required

Provider or registered integration-owner input is required; the user need not discover market-data formats or share any secret in chat.

| Provider     | Required non-secret evidence                                                                                                                                                                     | Why it matters                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groww        | Official partner authorization/token/callback/revocation specification and eligibility for this application; or explicit permission and product decision for a personal-token import alternative | Partner OAuth exists in official material, but its secure wire contract is missing from the inspected public guides. A personal-token form is a different connection product. |
| ICICI Direct | Official multi-user application eligibility plus callback method and documented one-time request/account binding; token expiry/revocation and response-retention terms                           | Implementing signed reads alone cannot safely associate a browser session with the correct application owner.                                                                 |

No question was sent to a provider and no answer has been received. Existing user permission to research all brokers does not supply these private registration/protocol facts. Credentials, when eventually needed, belong only in the configured server secret store.

## Next implementation specification

After the missing official contract arrives, implement the documented mechanism with explicit consent, owner/session re-admission before and after provider waits, replay-safe request binding, profile verification, encrypted token/raw-response retention, precise expiry and local/remote revocation distinctions. Use only profile and holdings operations. Reject unsupported quantity/cost components; retain original response provenance and require the existing baseline-bound holdings preview and explicit confirmation. Include privacy export/deletion, connected web/native return behavior and offline refusal.

Author acceptance for cross-owner substitution, expired/replayed authorization, replacement/revocation during a provider wait, exact quantity/cost reconciliation, no silent row dropping, encrypted export/delete and real form-to-API preview/confirmation. Do not manufacture successful provider callbacks for an undocumented protocol.

## Manual document acceptance

1. Open each official link and distinguish the documented personal-account mechanism from the missing partner protocol.
2. Check that DEV-028/SRC-021 still list Groww and ICICI as unimplemented connections and that named file importers remain separate.
3. When provider evidence becomes available, record its version/date and exact answers above before authoring the connector.

This update changes documentation only. No migration, dependency, app route or executable test was added; reserved migration108 and cases1750–1759 remain unused. User-owned validation/commit command: `pnpm sdlc "Record Groww and Breeze connection prerequisites" --checks-only`. No service startup or E2E run is needed for this document-only change. Formatting/checks/commit were not run by the agent.

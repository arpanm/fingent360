# Public reading share — DEV-029

Authored 2026-09-15. Reader → More item actions now prepares a canonical public reading URL from the validated deployment origin and discovery ID. It never copies the current URL/query or a private account route. Local/offline editions explicitly say no public app link is available and point readers back to original source evidence.

Share opens the browser share chooser where supported, or the restricted Android connected-mode native chooser. Copy link and a selectable read-only field remain available on supported public deployments. Cancellation is distinct from failure; a chooser handoff is not claimed to be delivered to a recipient. No automated message, phone number, WhatsApp API, new account permission or provider is involved. Users choose their own sharing destination; available OS share targets are outside the app's control.

## Layers and boundaries

- Shared contract validates HTTPS public-looking origins and discovery IDs; removes all query/hash/private context through canonical construction. It rejects localhost/private IPs, appassets, credentials, non-root origins and internal/local suffixes. DNS reachability/public deployment verification remains operator acceptance; validation cannot prove DNS is public.
- API/backend reuses the existing published public discovery reader route. No private payload/API, new server endpoint, database migration or stored recipient is needed.
- Web/Android shared Reader uses the new component. Android bridge independently restricts the exact configured connected web origin and public read route before opening ACTION_SEND's chooser. Browser/native URLs carry only public item ID. No keys or personal records enter sharing payloads.
- Offline mode has an explicit unavailable state, not a broken appassets URL. Old APKs fall back to available browser/copy capability until rebuilt; Android share support requires a rebuilt package.
- No automatic replay or offline outbox is appropriate for a user-selected share chooser; repeat requires another deliberate click.

## Primary research and input record

The [W3C Web Share specification](https://www.w3.org/TR/web-share/) defines user-selected share targets, user activation and cancellation. Its implementation material does not justify assuming WebView support; a narrow Android bridge supplies the app capability. No provider/private input is needed for authoring this slice. Real public web deployment and physical-device acceptance are separate later steps. This does not implement WhatsApp business automation or an iOS shell.

## Authored acceptance and manual next actions

Contract tests cover canonical URL and rejection of private/context-bearing origins and route injection. E2E-WEB-1255 simulates only public hosting and share chooser capability while using the real app and isolated real reader API; verifies exact payload/context exclusion/cancellation/fallback. E2E-OFFLINE-1255 verifies local edition does not offer a device-only link. Neither case sends a message.

No dependencies or migrations changed for this slice. Existing web/API/database services are required for connected E2E. User runs:

```sh
pnpm sdlc "Add safe public reading share" -- --grep DEV-029
```

Use the `pnpm dev` URL with `/#today` → reader → More. Local development intentionally cannot advertise its localhost URL as publicly shareable. For Android, rebuild/reinstall using the existing packaging instructions; configure the actual public HTTPS web/API origins, open a published reader and Share. Verify native chooser, cancellation, copy fallback, no recipient preselection and no query/account data in payload. Do not send real private material. Leave test watch/eye mode off; report the failed ID/project/run path and redacted error. No agent-run tests/build/format/check/migration/commit occurred; baseline a2c53a0.

DEV-029 stays Partial for WhatsApp business delivery/consent/templates/webhooks, iOS signing/shell and real connected/device acceptance.

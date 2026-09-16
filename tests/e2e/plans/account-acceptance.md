# ACCOUNT-001 acceptance

Scope: real account registration, owner isolation, watchlist persistence, sign-in/out/deletion, safe unavailable/retry states and shared on-device watchlist behavior. Existing API/contracts and database migrations are reused.

1. Fresh installation: user runs privacy:keys, starts migrated databases and restarts dev. Existing installations restore their original keys instead. Never include keys in reports.
2. User runs `pnpm sdlc "Complete account workflow" --story ACCOUNT-001`. Complete check gates precede commit and connected/offline execution. No agent-run validation.
3. API030/031 cover real storage, isolation, consent, origin, passwords, cookie protection and deletion. WEB030/033 cover actual persistence, bounded destination navigation and desktop/mobile layouts.
4. WEB034 commits a real watchlist update and simulates only read outages. Confirm save acknowledgment survives, unchanged writes are disabled, failed reload cannot overwrite saved choices and later reload restores them. No operator-key instructions appear to the user.
5. OFFLINE034 creates and reloads an on-device account/watchlist with zero API network traffic and unchanged-write prevention. Physical Android installation remains separate.
6. Inspect TODO's validation column, the ACCOUNT-001 generated validation block and docs/bugs. Only the complete required matrix at the same fingerprint plus passing check gate qualifies as automated acceptance. An unresolved case retains its failure details and Open bug; an exact strict pass resolves it. Skipped and unselected cases never count as passes.

All new cases are authored; no execution result is claimed.

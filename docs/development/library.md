# Private reading library (UX-002D)

The Saved page persists saved summaries, reactions, reading positions, topic preferences, in-app reminders and read notifications. API paths live below `/api/v1/account/library` and share existing authenticated ownership and Origin enforcement. Every private table cascades on account deletion and is included in the account JSON export. No new packages or infrastructure.

A save snapshots the published item version, title, summary and authoritative source URL. Repeated saves are idempotent. New source revisions do not rewrite the saved summary: the page identifies an updated version; opening the reader uses the latest version. Withdrawn items retain the user's saved summary with an availability notice. Unsave does not silently cancel scheduled reminders; cancel those separately under Reminders.

Reading position is an explicit persisted percentage for one item version, not dwell tracking. No reading-time collection exists. Feed preferences support followed and muted topics and chronological or For you order. Reset clears topic choices, reactions and positions while preserving saves/reminders. The `explicit-v1` deterministic ranking uses followed topics, more/less reactions, related topics and saved items, with source variety after two consecutive items from the same source. Muted topics are excluded. Chronological mode ignores personalized scores. Each result carries `whyShown`; this is content relevance, not an investment recommendation. Explore may pass `q` (at most200 characters) and `kind=news|term|annual`; both filter the entire published corpus before ranking/pagination. Filters are bound to cursors. Cursors are opaque, validated tokens binding the authenticated account, ordered published versions and personalization inputs. An unchanged snapshot pages without duplicates; content or preference changes produce409 and require refresh from the first page. Invalid tokens return400. New unpublished drafts do not invalidate a published snapshot.

## Reminders and recovery

A reminder records an absolute UTC time plus the user's IANA time zone. The browser displays/edits in the device's detected time zone and rejects invalid local clock values. Dates must be in the future and within one year. Creation uses an account-scoped idempotency key; retrying identical data returns the same reminder, while a changed payload with the same key returns409. Editing/cancellation require the displayed version and only operate on pending owned reminders.

`LibraryReminderWorker` starts on the API lifecycle and checks due jobs every five seconds, up to50 per batch. It locks rows with `FOR UPDATE SKIP LOCKED`, inserts a notification with unique reminder_id, and marks the reminder delivered in the same transaction. A crash rolls back both operations; restart catches overdue pending rows. Multiple API processes can safely share work. The worker rechecks the latest non-draft publication under an editorial row lock; withdrawn or missing items cancel instead of notifying. Cancel and delivery serialize on the same row; if delivery won the race, cancellation reports conflict rather than pretending to prevent delivery. No email, push, background browser notification or external messaging is sent. Delivery happens while the API is running, and the next library load shows it. Account deletion removes pending jobs and notifications.

## Manual verification

After parent formatting/checks, apply migration011 via `pnpm db:migrate` and restart `pnpm dev` to load the worker. Discovery migration010 must supply published glossary items; no fabricated news is required. Open the printed web URL at `#saved`. In the existing manual test UI run `@UX-002D` in api/desktop/mobile with watch mode off.

- E2E-API-121: anonymous rejection, strict input/Origin, snapshot save idempotency, reactions/positions/preferences, deterministic ranking/muting/reset, another account isolation, due reminder delivery, idempotency conflict, owned cancellation, stale-version rejection, private export and no-store.
- E2E-API-122: original saved snapshot persists across publication revisions; withdrawal cancels a due reminder without notification; privacy export retains the snapshot; restores the glossary publication afterward. Requires local operator setup, no provider fetch.
- E2E-WEB-120: signed-out gate, persisted saved item, local reminder scheduling, reload/cancel, feed order persistence, remove save and responsive width.
- Manual recovery: schedule a reminder, stop the API before its due time, restart afterward, reload Saved and verify exactly one notification. Restart again and verify no duplicate. No data reset.
- Manual correction: publish a corrected source revision; Saved must retain its old summary/version and display the new-version notice. Withdraw it; Saved must label availability while preserving the user's snapshot.

The implementation is integrated. [Current verification](status.md) records executed checks, migrations and cases. On failure provide `artifacts/e2e/latest.md` with its run time, targets and selected IDs, not private account exports.

## Library controls and incoming reminders

Saved supports title/summary search, finished/unread filtering and current publication availability. Reminders filter scheduled/delivered/cancelled entries. Local-time shortcuts choose the next7pm or tomorrow9am; the displayed time zone is the device's IANA zone. No quiet-hours policy is implemented. Snooze creates a new, idempotent reminder for tomorrow9am and retains the original delivery history.

While Saved is visible, it polls every15seconds for incoming notifications. Hidden pages stop the timer and cancel the pending poll; unmount removes both. Poll responses use generation/active guards and cannot reset unsaved preferences, reminder dates or selected items. Only explicit preference reset discards the preference draft. Authentication failure is recognized only by HTTP401; network/unreadable responses show a retry error instead of claiming the user signed out.

Delivery uses the latest published title under the publication lock; saved-item summaries retain their original version. Notifications snapshot the delivered title and time, not the full article body/version. E2E-WEB-120 additionally exercises search/availability/presets; WEB121 waits for a real due notification, verifies an unsaved preference survives refresh, and snoozes to one new pending reminder. Worker unit fixtures check corrected-title selection and withdrawal suppression; they do not substitute for the documented crash/restart database acceptance.

Manual visibility acceptance: with browser network tools open, hide the Saved tab for over30seconds and verify no new library polls; return to refresh, then navigate away and verify polling stops. Private drafts must survive visible polling and manual notification acknowledgement.

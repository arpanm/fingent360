# Android offline reading and learning

The offline build serves a dated public content snapshot through the same validated client contracts. Its publication, effective and retrieval dates remain unchanged. It is not a live market feed. Bundled source evidence, editions and reviewed visuals are readable when present; unavailable evidence/history returns an explicit error. Source refresh, operator writes and cloud AI are unavailable, never simulated as successful.

Local account reading data is persisted by the shared IndexedDB transport: saves retain edition snapshots; reactions, reading positions, explicit topics/mutes and feed order remain private to that device account. Feed pagination binds snapshot, filters and preferences; changed context requires restarting pagination. No dwell tracking is added. Reset removes preferences/reactions/positions while preserving saved items and reminders.

Reminder delivery catches up while the app opens or requests local data. Delivery is idempotent and uses the snapshot's current published title; withdrawn items cancel pending reminders. No native background notification, email, push or quiet-hours guarantee is provided. Closing the app can delay delivery until reopening. Reminders use validated time zones and absolute due times, with optimistic version checks for edits/cancellation.

Quiz rubrics are the same authored glossary rubrics as the server. Attempts and votes are local and private; offline poll counts describe only this account's local response, not the online audience. Saved form suggestions use only this account's own saved goal/holding inputs. Assistance performs deterministic query matching on complete dated glossary summaries and explicitly consented local goal names; configured cloud provider requests fall back transparently to query mode and never contact a provider.

Private stores: `localLibraries`, `localLibraryRequests`, `localLearning`, `localLearningRequests`, each keyed by local user ID. Account deletion removes every owned map entry. Export helpers return the normal library/learning contract; request keys are internal deduplication state, not credentials.

Authored acceptance: E2E-OFFLINE-201 exercises real browser transport persistence across reload, saved UI, idempotent reminder catch-up, private learning, provider fallback and account isolation. E2E-OFFLINE-202 checks input validation, search and unavailable refresh. Run only against the dedicated offline build/project. No verification is inferred from authoring these cases; parent integration records executed evidence.

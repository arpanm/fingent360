# Finance stored on this device

The offline runtime serves the existing account and finance contracts from a serialized local IndexedDB transaction. It does not need an API or database server. Goals, holdings, account settings and histories start empty. User-entered holdings remain unverified acquisition costs, never current valuations. Macro inbox observations come from the dated bundled snapshot; they are not refreshed prices or live notifications.

Local registration requires the existing explicit storage consent and a password of at least 12 characters. Passwords use WebCrypto PBKDF2-SHA256 with 600,000 iterations and a random 16-byte salt. A local session lasts seven days and survives app restarts. Expiry is checked before every private account route. Sign-out ends that device session; there are no remote sessions to revoke. Failed logins are limited to five attempts per username per 15 minutes. This is a local safeguard, not a remote identity service.

Password hashing does not encrypt the device database. Device access controls remain important. Clearing app storage or uninstalling can remove local records. There is no password recovery, server synchronization, cross-device account sharing or automatic upload. JSON privacy export excludes credentials and includes owned revisions, saved reading and learning data. Export is not currently a restorable backup format.

Goals use the shared exact whole-paise calculations, explicit no-growth assumptions, repeatable goal types and immutable revisions. Stale version updates fail with a conflict. Holdings use strict ISIN/decimal quantity/whole-paise CSV parsing. Preview does not replace holdings; explicit confirmation does. Confirmation retries return the same saved revision. Previews expire after 30 minutes. Account deletion removes only that account's settings, goals, holdings, learning and reading records. Other local accounts remain intact.

Implementation keys are `localAccounts`, `localGoals`, `localHoldings`, `localLibraries`, `localLibraryRequests`, `localLearning` and `localLearningRequests`, each indexed by account ID. `localLoginAttempts` is indexed by normalized username. The root offline dispatcher handles transaction persistence and conflicts; these handlers never open independent IndexedDB transactions.

## Authored acceptance coverage

- E2E-OFFLINE-010: consent rejection, exact large monetary amounts, goal version conflicts/history, preview without save, idempotent holdings confirmation, reload persistence, strict export without credentials, sign-out and password sign-in.
- E2E-OFFLINE-011: another account cannot read goals or confirm previews, incorrect deletion password fails, deletion preserves the other account, removed goals remain in owned historical export.

- E2E-OFFLINE-012: seven-day expiry blocks all private modules, failed-login throttling persists through reload, and sign-in recovers after the lockout expires.

These cases use browser `fetch` through the real offline transport in the dedicated offline Playwright project. They cannot run through Playwright's server-side request client. No test execution or Android device verification is claimed by this document; follow the root Android/offline runner instructions and retain its report. Physical-device storage durability, device-level security and app-upgrade migration remain release checks.

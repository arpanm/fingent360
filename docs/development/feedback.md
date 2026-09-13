# Feedback: capture, review and reliable delivery

FEEDBACK-001 implements the supplied mock as a round pointing-finger launcher and two connected choices: **Screenshot + feedback** and **Feedback only**. The supplied finger image is a UI asset. Opening the launcher does not capture the screen, request microphone permission or submit anything.

Choose Screenshot + feedback to capture the current app viewport, then inspect the preview. Drag a crop or use its labelled keyboard range controls, add opaque covers over private details, undo a cover, reset the crop, retake or remove the screenshot. Only the final selected PNG is attached. Feedback only opens the same composer without taking a screenshot. Escape, Back, cancel and draft-discard controls keep these actions deliberate.

Browser capture renders the app viewport; Android captures its visible WebView. Neither captures another app or the surrounding operating-system screen. Raw input/textarea values, editable fields and explicitly marked private elements are covered and removed from the browser capture clone. This does not guarantee that every rendered private fact is hidden: names, holdings or other information already displayed as ordinary page text may still be visible. Review the preview and cover/remove anything you do not want to submit. Browser DOM rendering can differ from the screen, and inaccessible external images may be omitted; use the preview rather than assuming a pixel-perfect recording.

Write feedback, optionally record a voice note, or use both. Record requests microphone access only when selected; stop, cancel, backgrounding and closing stop recording tracks. Listen before submitting and remove the voice note if needed. Permission denial leaves typed feedback available. Voice is an audio attachment, not transcription: no speech-to-text provider, paid model or external assistant is called. Limits are 5,000 text characters, 2 MB PNG, 4 MB audio and a recorder limit of two minutes. Attachment validation can reject unsupported/corrupt files; the server does not independently decode audio to measure its duration.

Submission requires explicit consent. The reviewed text, final image/audio and small visible context—screen, runtime, app version, viewport and capture time—become an immutable queued report. No account/holdings/goals/logs are silently appended. A confirmation that says saved on this device means local persistence, not server delivery. History at `#feedback` shows pending, sending, received, failed and deletion states, the destination and attachment preview. Keep the receipt capability private; the app stores it locally and sends it in a header rather than a URL.

## Configure delivery

Open feedback history and its **Feedback delivery** settings. The feedback API setting is separate from workspace web/API connection settings. Use the origin of your own compatible Fingent360 API, such as `https://api.example.com`, without a path, query, fragment or URL credentials. Enable delivery only for the destination you intend. This setting sends explicitly submitted feedback; it does not synchronize financial records.

The page first shows **Opening saved feedback…**. Delivery controls appear only after the stored configuration is available, so an unchecked placeholder cannot be mistaken for a saved paused setting. If storage cannot open, the page shows the error and **Retry opening feedback**; it does not offer settings or claim an empty history. Retry reads the existing store again. Saving a paused setting confirms that reports remain on this device, and the setting survives reload. WEB196/197 cover delayed and failed storage opening; WEB194 waits for the ready form before changing delivery.

Web defaults to its configured API/current origin. Non-native local development also permits HTTP loopback origins. The server accepts browser submissions only from its configured `WEB_ORIGIN`, with a separate exact Android appassets origin exception limited to feedback endpoints. An unrelated origin is not a valid CORS workaround. Android requires HTTPS even for its dedicated feedback destination; configure a controlled reachable HTTPS API for native delivery testing.

The bundled offline Android app defaults to no feedback API and delivery disabled. Reports remain on the device until delivery is enabled. Android keeps feedback in an app-private native store so switching between bundled and configured CDN workspace origins does not lose it. Web uses a separate IndexedDB database. Limits of 100 records and 32 MiB serialized web queue prevent unbounded local growth; storage errors preserve existing records instead of resetting the queue.

Once a report has been attempted, it remains bound to that original destination. Changing settings does not redirect it to a different server; restore the original destination to retry or complete deletion. An unsent report can use the enabled destination on its first attempt. Disabling delivery pauses new claims; an already in-flight request may still finish.

## Receipt, retries and deletion

Delivery checks run while the app is open/visible and when returning online or resuming. Network errors, 408/429 and server errors retry with bounded backoff; other rejections require deliberate Retry. A persisted lease protects against concurrent tabs or restart duplicates. Cross-tab notifications contain only an invalidation signal, never feedback content or capabilities; each tab rereads the durable store. Out-of-order status responses cannot replace a newer receipt version. A terminal POST error does not cancel a deletion requested while that POST was in flight. There is no operating-system background worker or promise of delivery while the app is closed. Web requests time out after 20 seconds; native requests after 30 seconds.

Retries reuse the same UUID, receipt token and immutable payload. If the server saved the report but the acknowledgment was lost, the next attempt returns its receipt instead of creating a second report. Received reports can refresh their status after operator review without submitting again. A changed payload under the same ID is rejected; write a new report to add different content.

Delete before any attempt removes the local report. Delete after an attempted, received or uncertain submission retains a durable deletion intent until the original server acknowledges it. The server creates a capability-owned cancellation tombstone even when the original POST never arrived, so a late POST cannot resurrect it. If offline or pointed at a different destination, deletion stays visibly pending. The app must not claim remote removal while acknowledgment is uncertain.

Server content and attachments expire after 30 days and are physically scrubbed on the next feedback API operation. Explicit deletion scrubs them immediately. Minimal hashes/ID timestamps remain to reject replay; database-backup retention is a separate operator policy. Local feedback history remains until the user deletes it, and account deletion does not implicitly delete this separate capability-owned store. See [API and retention details](feedback-api.md).

## Operator workflow

Authenticated operations users open the feedback inbox, filter received/reviewing/resolved reports, inspect private attachments and update status with an expected version. Another update produces a conflict instead of overwriting silently. Operator deletion scrubs content and records an opaque actor/action audit; the inbox never exposes receipt tokens or public attachment links. Status changes are visible when the submitting user checks their receipt. This workflow reviews feedback inside Fingent360; it sends no email or third-party ticket.

## Build and acceptance

Apply additive migration 016 before server submission. Normal web/API services and the existing manually operated E2E runner are reused; offline cases use the dedicated Android web build. Executed builds, gates and platform limits are recorded in [status](status.md).

- API190–193: identity/replay/ownership/tombstones, PNG and native-origin bounds, protected review/private attachments, physical expiry scrubbing.
- WEB190–195: real viewport crop/cover, draft navigation, synthetic-device audio and permission denial, simulated lost acknowledgment with a real receipt, and operator-to-user status.
- OFFLINE230–235: disabled delivery/reload persistence, safe settings and consent cancellation; simulated terminal POST rejection during deletion, out-of-order receipt responses, and cross-tab queue visibility with payload-free notifications.
- Native acceptance: same-key APK update, app-only capture/privacy masks, microphone allow/deny/stop/background, queue across restart/origin changes, controlled HTTPS delivery/deletion, existing finances/file navigation unchanged.

Synthetic microphone input and lost-response/permission failures are explicitly labelled test simulations; successful receipts still require the real API. Never submit real private documents as fixtures or clear a user's existing device/database to simplify testing. Record exact runs, APK hash and physical-phone limits in [current status](status.md). Further implementation details are in [queue delivery](feedback-sync.md) and [native bridge](feedback-native.md).

The real API applies an hourly address-bucket limit of20 new reports/cancellation tombstones (200 globally). If normal app submission returns429, keep the report and retry after the next server hour. Identical report retries and deletion of an existing report do not consume new-report quota. Connected E2E cases now use per-test temporary schemas and real API processes with the same limits, so repeated runs do not consume the normal app's allowance. No quota is cleared or enlarged to make tests pass. API194 exercises the real limit and rollback in its own schema; [runner details](../../tests/e2e/README.md#repeatable-feedback-tests) describe creation, cleanup and discovery behavior.

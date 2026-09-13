# Native feedback bridge — FEEDBACK-001

The native package is `com.fingent360.app`, version code **3**, version name **0.3.0-feedback**. Rebuild and install over the existing same-key build to retain local records. Version constants and generated metadata are aligned; actual build and emulator evidence is recorded below.

`window.FingentAndroid` exposes these asynchronous methods to the trusted main frame through the document-start WebMessageListener bridge:

- `feedbackRead()` → `{revision, records, config: {enabled, apiOrigin}}`.
- `feedbackWrite(expectedRevision, {records, config})` → `{revision}`. A conflict rejects with “Feedback changed in another view. Reload and retry.”
- `captureFeedback()` → PNG data URL of the currently visible WebView viewport.
- `sendFeedback(apiOrigin, method, id, receiptToken, body)` → `{status, body}`. Method is POST, GET or DELETE. POST uses null ID/token; receipt reads/deletes require a UUID and receipt token.

Messages have correlated request IDs and Promise results. Replies are discarded if the originating page is replaced. No synchronous JavaScript interface, account cookies or provider keys are exposed. The feedback file is separate from WebView-origin storage, so switching offline/CDN workspace mode does not lose the queue. The app-private AtomicFile contains a revision, records and explicit destination configuration. Writes use a process-wide lock and compare-and-swap; corrupt/unsupported or full storage rejects without resetting saved records. Limits are 100 records and 40 MB, with object/config shape checks; the web queue applies the detailed feedback contract.

Capture occurs only after an explicit JavaScript capture call. The web composer is responsible for hiding its own controls and obscuring sensitive fields before asking native capture. Native draws the WebView viewport, excluding surrounding Android UI, limits dimensions to 4096 and the pixel buffer to four million pixels, and downscales PNG output to fit two million bytes. Capture has no system-wide screen permission and does not collect other apps or hidden scroll content. Users must preview and remove/crop unwanted content before submitting.

Microphone permission is requested only when a trusted active page requests audio capture. The native manifest and runtime prompt permit audio only, never camera. Pending permission requests are denied when cancelled, backgrounded or navigated away; destruction closes the WebView and native feedback worker. `f360-pause` allows the web recorder to stop active tracks before backgrounding, and `f360-resume` allows the queue to retry explicitly submitted feedback. The recorder must also stop tracks on cancel/stop/visibility changes. Granting OS permission is not a recording or submission action.

Delivery runs outside the UI thread, only to the exact enabled HTTPS feedback origin. Paths are fixed to `/api/v1/feedback` and `/api/v1/feedback/<uuid>`; redirects are rejected. The receipt header is `X-Feedback-Token`. Native sends an appassets Origin, no WebView cookie or provider/account authorization, applies a 30-second network deadline and bounds response/submission bytes to 8.5 MB. Enabling delivery is an explicit visible setting in the web feedback UI; it can be configured while the financial workspace stays offline. There is no scheduled closed-app delivery or native background service. Idempotency, retry policy and per-record destination binding belong to the shared durable web queue.

## Required integration checks

1. Build/install version 3 with the same key, retain an existing financial workspace, and capture a scrolled viewport with a masked password field. Preview must exclude the composer and system chrome.
2. Allow then deny microphone permission, cancel recording, background/resume and change pages. Audio must stop and no camera permission may be requested.
3. Submit synthetic feedback offline, restart, switch workspace origins and read the same native queue. Stale revision writes must fail without losing another write.
4. Enable a controlled HTTPS API destination. Verify the configured fixed path, idempotent receipt, no account cookies and delivery/status/deletion. Disabled or changed destinations, redirects, server failures and oversized responses must remain actionable failures without losing a queued report.
5. Exercise file import/export, Back, source navigation and ordinary device/connected mode after adding the bridge. Re-run browser/API/offline feedback cases and inspect actual APK metadata before handoff.

## Emulator evidence — 2026-09-13

Executed on the owned Android 35 emulator `emulator-5580`, ADB server 5039, installed version `0.3.0-feedback (3)`, web bundle `056cdb63cb6ba66f153655282f5ba0a6eb801397c798b636cfb16414f063b1e9`:

- Floating launcher and screenshot flow opened the actual native viewport capture. The captured PNG was 1080 × 2209 and excluded Android system chrome and the feedback launcher/composer. A 70%-width crop produced a 493 × 1440 attachment. Native inline PNG preview worked. Evidence: `artifacts/android/feedback-capture.png`.
- The actual Android audio-only permission dialog appeared and “While using the app” reached audio initialization. This emulator was launched with `-no-audio`; Chromium logged “Unable to select audio device” and the UI reported unavailable audio input. Real microphone sound capture is therefore **not verified** here.
- A clearly labelled, test-only 440 Hz WebAudio stream exercised the real composer MediaRecorder path for 9.74 seconds. The resulting audio/webm attachment played with `readyState=4`, `paused=false` and no media error. This proves codec/attachment/playback integration, not hardware microphone recording. No test override was shipped; the temporary override disappeared at app restart. Evidence: `feedback-recording-synthetic.png`.
- Submitted one synthetic text/screenshot/audio report in airplane mode with delivery disabled. UI showed Saved on this device, then Pending delivery. Force-stop/reopen retained the same report, dimensions, audio byte length and revision. `feedback-queue-before.json` and `feedback-queue-after-restart.json` are identical summaries without receipt tokens or attachment bodies; `feedback-history-restart.png` shows the persisted history.
- Switched to a deliberately unavailable loopback HTTPS workspace, observed native recovery, returned offline and restored the exact original connection settings. Queue summary remained identical (`feedback-queue-after-mode.json`). The combined stored goal/holdings SHA-256 before/after was identical; one goal-owning and one holdings-owning workspace remained (`feedback-finance-before.json` / `feedback-finance-after-mode.json`). No account or financial data was reset.
- A stale native revision write failed with the documented conflict and left the queue unchanged (`feedback-cas.json`). Disabled destination delivery was rejected before a request was sent.

A real native HTTPS delivery/receipt has **not** been verified: no Android-trusted certificate is available for the local controlled API, and TLS policy was not weakened or bypassed. Browser/API integration evidence is separate. Successful loading of a real configured CDN and physical-phone microphone behavior also remain separate checks. The synthetic report was used for the final same-signing-key update/persistence check and then removed as recorded below.

### Final same-key update and cleanup

Installed the final APK with `adb -P 5039 -s emulator-5580 install -r` successfully. Final build identity:

- Built at `2026-09-13T14:57:50.842Z`; version `0.3.0-feedback (3)`.
- APK SHA-256: `a5a2b85addb8527529e4aab9e0031d20338a8831368a55fe8aec252a080d6a5b`.
- Installed web bundle: `6becc836f2eada6320ec36df7fddcf113c0d19d13edfdebc7e2e4d0054f3108f` (`feedback-final-identity.json`).

The pending report summary was byte-identical after updating (`feedback-queue-after-update.json`); stored goal/holdings hashes and original connection configuration also matched exactly (`feedback-finance-after-update.json`). The final build displayed its stored text and 493 × 1440 screenshot and played the stored synthetic voice note with readyState 4 and no error (`feedback-final-preview.json` / `.png`). This verifies existing queue/media preservation through an actual signed APK update.

After collecting evidence, removed only the never-attempted synthetic report through the app’s Delete feedback → Confirm deletion UI. Native read confirmed zero feedback records, delivery disabled and the original offline connection settings restored (`feedback-final-cleanup.json`). Restored the initially ungranted microphone permission and cleared only the test-created permission decision flags. Stopped only the owned `emulator-5580` and its dedicated ADB server on port 5039. Existing financial data and the installed APK remain in that AVD; no reset or uninstall occurred. Physical microphone and real native HTTPS delivery limits above still apply.

### Latest delivered APK after shared dialog correction

A final web-only correction ensures only the top open dialog consumes Back navigation. Native bridge code is unchanged from the capture/media verification above. The rebuilt APK was again installed with the same key on `emulator-5580`:

- Built `2026-09-13T15:05:34.901Z`, version `0.3.0-feedback (3)`, 3,102,185 bytes.
- Final APK SHA-256: `7a6967556e3f2198511bad4d603056db23d9a59c2fe1034b8f460073e054ea7d`.
- Installed web bundle: `b2bbe38ac3d42a3af816a49d7255ddfeb4292223da31413cf1c0885e1d3de772`.

Verified the queue remains empty after the test cleanup, feedback delivery stays disabled, original connection settings remain intact, and all stored goal/holdings bytes match the original hash. The floating launcher opens both screenshot and feedback-only choices on this exact final bundle (`feedback-latest-update.json`, `feedback-finance-latest-update.json`, `feedback-latest-bubble.json` / `.png`). Closed the launcher and stopped only the owned emulator and ADB5039 again. No new microphone recording or HTTPS-delivery claim is added by this final update check; the preceding actual capture/codec/queue-update evidence and stated limitations remain applicable.

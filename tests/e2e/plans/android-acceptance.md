# ANDROID-001 acceptance

User-authorized APK delivery includes the actual native build and offline functional verification. Keep physical-phone acceptance separate from desktop viewport emulation or compilation.

| ID                 | Layer / action                                                                                | Expected result                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ANDROID-NATIVE-001 | Install development-signed APK on Android 8+ with current WebView; airplane mode; cold launch | Today loads bundled public snapshot without API/database/network; snapshot date visible                                |
| ANDROID-NATIVE-002 | Register local account; create a goal and holding; force-stop and reopen                      | Confirmed values and active session persist; local account starts empty; no server account reused                      |
| ANDROID-NATIVE-003 | Device Back from reader/evidence, dialog and dirty form; More→settings; keyboard/rotation     | Contextual return, modal dismissal, discard confirmation and unobscured controls; home Back exits                      |
| ANDROID-NATIVE-004 | Upload CSV via Documents; preview/confirm/reload                                              | File chooser works, invalid/oversized formats rejected, exact totals and revisions retained                            |
| ANDROID-NATIVE-005 | Privacy JSON/holdings CSV/media WebM save and cancel                                          | Native destination picker, successful actual file write or accurate cancellation; no storage permission/silent sharing |
| ANDROID-NATIVE-006 | Save/reaction/reminder, learning/poll, sign-out/re-login and delete account                   | Owned records persist, reminder appears on next open after due time, deletion does not affect other account            |
| ANDROID-NATIVE-007 | External source link and connection mode settings                                             | Explicit native confirmation; external HTTPS browser; invalid origins rejected; offline records never uploaded         |
| ANDROID-NATIVE-008 | Configure unavailable HTTPS CDN, choose offline recovery; return to local profile             | Actionable recovery, no blank trap, local data remains; deployed connected acceptance awaits real deployment           |
| ANDROID-NATIVE-009 | Update APK in place using same signing identity                                               | Existing IndexedDB schema1 and confirmed revisions survive; clearing storage/uninstall is not an update procedure      |
| ANDROID-NATIVE-010 | TalkBack, text scaling, 320–430px/landscape, reduced motion, older supported WebView          | Named reachable controls, reading order and readable content; unsupported WebView offers update route                  |

Offline Playwright project: financial/account cases010–012; reading/library/learning201–202; journey203; UI204. Tests run against `artifacts/android-web`, no API is started, and any network `/api` request fails. Record actual run IDs/counts, native package/hash, emulator/API/device, captured artifacts and limits in status. Use clean owned test accounts/AVD only. Never reset user device or existing app data to simplify tests.

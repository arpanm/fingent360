# iOS preview shell

Implementation is authored, not built or device-verified. The initial shell reuses the entire shared offline web application and API emulation. A native Network.framework listener serves **bundled public assets only** at `http://127.0.0.1:18763`; it is not a remotely hosted backend. This stable loopback origin preserves WebKit storage and provides a potentially trustworthy origin for WebCrypto under the [Secure Contexts specification](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy). Native behavior still needs real iOS acceptance. The package bootstrap refuses to start private workflows when WebCrypto/UUID/IndexedDB are absent instead of substituting insecure operations.

The listener binds only loopback, checks Host, handles bounded GET headers, validates decoded paths against the bundled directory, refuses traversal/symlinks out of that directory and exposes no private database or native command endpoints. Port contention fails visibly; it never chooses another port and silently changes private storage origin. WKWebView uses persistent app storage. HTTPS connected mode loads only the configured origin; external user-clicked HTTPS source links require a native confirmation before opening the system browser. Cross-origin redirects, subframes, credential URLs and arbitrary schemes cannot become the main app. A restricted main-frame native feedback reply handler is installed; a restricted broker custom-scheme return is installed; no universal-link entitlement is installed. A reader link is not an authorization callback.

The preview now authors native screenshot/AAC recording, encrypted per-origin feedback queue and foreground receipt transport. Capabilities are reported only by the installed native bridge. Three owner-bound broker callback returns are authored; push and background-delivery worker remain unavailable. See [iOS feedback implementation and acceptance](ios-feedback.md). See [broker return boundaries](ios-broker-return.md). Protected native [private export/share](ios-private-export.md) now connects existing account/report/file flows. Preview features are authored; this does **not** establish physical-device parity or complete WhatsApp business delivery. iOS signing and physical-device acceptance are separate inputs; no IPA exists yet. There is no new API/DB schema: shared accounts, evidence, finance, consent/privacy and feedback APIs are reused. Offline/connected origins are deliberately separate and no private records are silently moved between them.

## Manual preparation

Prerequisites: existing repository dependencies installed by the user, Xcode with iOS16+ simulator/SDK, and macOS. No extra npm dependency or package install is introduced.

```bash
node scripts/ios-package.mjs
open artifacts/ios-preview/Fingent360.xcodeproj
```

Select a simulator in Xcode and click Run. For a physical iPhone choose your signing team and unique bundle identifier. The generator builds current shared web assets and writes an ignored Xcode preview project; it does not build/sign an IPA. Do not use this Debug-only preview project as an App Store submission. Production signing, app icons, distribution privacy declarations and channel review remain explicit release work. Save signing customizations outside the generated project before regeneration.

`ios/runtime-config.json` defaults offline with empty webUrl. For connected preview, set mode connected and a plain HTTPS deployment origin. The deployed web build must already contain its approved API origin (or serve `/api` same-origin) and correct cookie/CORS settings; the shell does not inject API credentials or weaken transport security. Repackage/reinstall when changing this native configuration. Offline shared web updates require regeneration and a new installation; connected content follows deployed web updates. Never include real private data in the public offline snapshot.

Author acceptance1560/1561 with the manual command:

```bash
pnpm sdlc "Add iOS preview shell" --grep "E2E-OFFLINE-156[01]"
```

These are authored configuration/bootstrap tests, not native-device proof. Complete [native acceptance](../../tests/e2e/plans/ios-acceptance.md) separately. Report the case ID/run artifacts, iOS version/device, Xcode build error and redacted app error if it fails. No build, test, format/check, installation or commit was executed by the agent; existing commit a2c53a0 and shared modifications await user-run gates.

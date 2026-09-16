// Native capability claims come from the installed main-frame reply bridge.
window.FingentIOSCapabilities ??= Object.freeze({
  nativeScreenshot: false,
  nativeAudio: false,
  nativeFeedbackStorage: false,
  brokerCallbacks: false,
  backgroundSync: false,
  push: false,
});
const note = document.createElement('details');
note.style.cssText = 'padding:8px;background:#f0f4f1;color:#15362b';
note.innerHTML =
  '<summary>iOS preview capabilities</summary><p>Native feedback capture, recording and encrypted storage are available only when the installed bridge reports them. Broker callbacks, push and background delivery remain unavailable. Delivery requires the app open and an explicitly enabled reachable HTTPS API.</p>';
document.body.prepend(note);
if (!window.crypto?.subtle || !window.crypto?.randomUUID || !window.indexedDB) {
  document.body.textContent =
    'This iOS WebView cannot provide the secure storage required by Fingent360. Update iOS, then reopen. Existing data has not been cleared.';
} else {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = window.__fingentEntry;
  document.head.append(script);
}

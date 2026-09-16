(function () {
  if (window.top !== window || !window.webkit?.messageHandlers?.fingentFeedback)
    return;
  const call = (action, args = {}) =>
    window.webkit.messageHandlers.fingentFeedback.postMessage({
      action,
      ...args,
    });
  window.FingentIOS = Object.freeze({
    saveFile: (filename, mime, base64) =>
      call('saveFile', { filename, mime, base64 }),
    armBroker: (broker, state, apiOrigin) =>
      call('armBroker', { broker, state, apiOrigin }),
    clearBroker: (broker) => call('clearBroker', { broker }),
    takeKiteCallback: () => call('takeBroker', { broker: 'kite' }),
    takeUpstoxCallback: () => call('takeBroker', { broker: 'upstox' }),
    takeAngelCallback: () => call('takeBroker', { broker: 'angel' }),
    captureFeedback: () => call('captureFeedback'),
    feedbackRead: () => call('feedbackRead'),
    feedbackWrite: (expectedRevision, state) =>
      call('feedbackWrite', { expectedRevision, state }),
    sendFeedback: (apiOrigin, method, id, receiptToken, body) =>
      call('sendFeedback', { apiOrigin, method, id, receiptToken, body }),
    startFeedbackAudio: () => call('startFeedbackAudio'),
    stopFeedbackAudio: () => call('stopFeedbackAudio'),
    cancelFeedbackAudio: () => call('cancelFeedbackAudio'),
  });
  window.FingentIOSCapabilities = Object.freeze({
    nativeScreenshot: true,
    nativeAudio: true,
    nativeFeedbackStorage: true,
    brokerCallbacks: true,
    nativeFileExport: true,
    backgroundSync: false,
    push: false,
  });
})();

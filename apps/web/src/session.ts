// Only an invalidation signal crosses tabs; account data never does.
const channel = new BroadcastChannel('f360-session');
export function announceSessionChange() {
  window.dispatchEvent(new Event('f360-session-changed'));
  channel.postMessage('changed');
}
export function onOtherTabSessionChange(change: () => void) {
  const receive = () => {
    window.dispatchEvent(new Event('f360-session-changed'));
    change();
  };
  channel.addEventListener('message', receive);
  return () => channel.removeEventListener('message', receive);
}

import { runtime } from './runtime';
export type NativeBroker = 'kite' | 'upstox' | 'angel';
export function brokerBridge() {
  return window.FingentIOS ?? window.FingentAndroid;
}
export async function armBrokerReturn(broker: NativeBroker, login: URL) {
  const bridge = window.FingentIOS;
  if (!bridge) return;
  if (runtime.mode === 'offline')
    throw Error('Broker authorization requires connected mode.');
  const apiOrigin = runtime.apiUrl || location.origin;
  if (apiOrigin !== location.origin || location.protocol !== 'https:')
    throw Error(
      'iOS broker return requires an HTTPS deployment serving its API on the same origin. Use the web connection until configured.',
    );
  if (!bridge.armBroker)
    throw Error('Reinstall the current iOS preview to enable broker return.');
  const state =
    broker === 'kite'
      ? new URLSearchParams(
          login.searchParams.get('redirect_params') || '',
        ).get('state')
      : login.searchParams.get('state');
  if (!state || !/^[a-f0-9]{64}$/.test(state))
    throw Error('Broker authorization state is invalid. Reconnect.');
  await bridge.armBroker(broker, state, apiOrigin);
}
export async function clearBrokerReturn(broker: NativeBroker) {
  await window.FingentIOS?.clearBroker?.(broker);
}

// Synthetic documented provider boundary; real API, PostgreSQL and import reconciliation remain active.
export const syntheticUpstoxHolding = {
  isin: 'INE002A01018',
  cnc_used_quantity: 0,
  collateral_type: '',
  company_name: 'Synthetic company',
  haircut: 0,
  product: 'D',
  quantity: 3,
  trading_symbol: 'SYNTHETIC',
  tradingsymbol: 'SYNTHETIC',
  last_price: 99,
  close_price: 99,
  pnl: 0,
  day_change: 0,
  day_change_percentage: 0,
  instrument_token: 'NSE_EQ|INE002A01018',
  average_price: 100.125,
  collateral_quantity: 0,
  collateral_update_quantity: 0,
  t1_quantity: 0,
  exchange: 'NSE',
};
export function installSyntheticUpstox() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname !== 'api.upstox.com') return original(input, options);
    const method = options.method || 'GET';
    if (url.pathname === '/v2/login/authorization/token' && method === 'POST') {
      const form = new URLSearchParams(String(options.body));
      if (
        form.get('grant_type') !== 'authorization_code' ||
        form.get('client_id') !== 'synthetic_upstox_key' ||
        form.get('client_secret') !== 'synthetic_upstox_secret' ||
        form.get('redirect_uri') !==
          'http://127.0.0.1:4100/api/v1/account/broker-connections/upstox/callback' ||
        !form.get('code')
      )
        throw new Error('Unexpected synthetic authorization exchange.');
      return Response.json({
        access_token: 'synthetic_access_token',
        user_id: 'SYNTHETIC1',
        broker: 'UPSTOX',
        is_active: true,
      });
    }
    if (url.pathname === '/v2/portfolio/long-term-holdings' && method === 'GET')
      return Response.json({
        status: 'success',
        data: [syntheticUpstoxHolding],
      });
    if (url.pathname === '/v2/logout' && method === 'DELETE')
      return Response.json({ status: 'success', data: true });
    throw new Error(
      'Unexpected broker operation. Synthetic fixture prohibits live broker calls.',
    );
  };
}

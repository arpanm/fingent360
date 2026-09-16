// Synthetic provider boundary only. Installed by the selected isolated E2E process;
// the real Nest controllers, encrypted PostgreSQL stores and import confirmation run.
export const syntheticKiteHolding = {
  tradingsymbol: 'SYNTHETIC',
  exchange: 'NSE',
  instrument_token: 123,
  isin: 'INE002A01018',
  product: 'CNC',
  price: 0,
  quantity: 3,
  used_quantity: 0,
  t1_quantity: 0,
  realised_quantity: 3,
  authorised_quantity: 0,
  authorised_date: '2026-09-15 00:00:00',
  authorisation: {},
  opening_quantity: 3,
  short_quantity: 0,
  collateral_quantity: 0,
  collateral_type: '',
  discrepancy: false,
  average_price: 100.125,
  last_price: 99,
  close_price: 99,
  pnl: 0,
  day_change: 0,
  day_change_percentage: 0,
  mtf: {
    quantity: 0,
    used_quantity: 0,
    average_price: 0,
    value: 0,
    initial_margin: 0,
  },
};
export function installSyntheticKite() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname !== 'api.kite.trade') return original(input, options);
    const method = options.method || 'GET';
    if (url.pathname === '/session/token' && method === 'POST')
      return Response.json({
        status: 'success',
        data: {
          access_token: 'synthetic_access_token',
          user_id: 'SYNTHETIC1',
          api_key: 'synthetic_kite_key',
          broker: 'ZERODHA',
        },
      });
    if (url.pathname === '/portfolio/holdings' && method === 'GET')
      return Response.json({ status: 'success', data: [syntheticKiteHolding] });
    if (url.pathname === '/session/token' && method === 'DELETE')
      return Response.json({ status: 'success', data: true });
    throw new Error(
      'Unexpected broker operation. Synthetic fixture prohibits live broker calls.',
    );
  };
}

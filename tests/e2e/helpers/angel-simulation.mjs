// Synthetic provider boundary only; no live broker credentials or customer holdings.
export const syntheticAngelHolding = {
  tradingsymbol: 'SYNTHETIC-EQ',
  exchange: 'NSE',
  isin: 'INE002A01018',
  t1quantity: 0,
  realisedquantity: 3,
  quantity: 3,
  authorisedquantity: 0,
  product: 'DELIVERY',
  collateralquantity: null,
  collateraltype: null,
  haircut: 0,
  averageprice: 100.125,
  ltp: 99,
  symboltoken: '123',
  close: 99,
  profitandloss: 0,
  pnlpercentage: 0,
};
export function installSyntheticAngel() {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname !== 'apiconnect.angelone.in')
      return original(input, options);
    const headers = new Headers(options.headers);
    if (
      headers.get('X-PrivateKey') !== 'synthetic_angel_key' ||
      headers.get('X-ClientPublicIP') !== '192.0.2.1' ||
      headers.get('X-MACAddress') !== '02:00:00:00:00:01' ||
      headers.get('Authorization') !== 'Bearer synthetic_access_token'
    )
      throw new Error('Unexpected synthetic publisher headers.');
    const method = options.method || 'GET';
    if (
      url.pathname === '/rest/secure/angelbroking/user/v1/getProfile' &&
      method === 'GET'
    )
      return Response.json({
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: {
          clientcode: 'SYNTHETIC1',
          name: 'Synthetic',
          email: '',
          mobileno: '',
          exchanges: ['NSE'],
          products: ['DELIVERY'],
          lastlogintime: '',
          brokerid: 'B2C',
        },
      });
    if (
      url.pathname === '/rest/secure/angelbroking/portfolio/v1/getHolding' &&
      method === 'GET'
    )
      return Response.json({
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: [syntheticAngelHolding],
      });
    if (
      url.pathname === '/rest/secure/angelbroking/user/v1/logout' &&
      method === 'POST' &&
      JSON.parse(String(options.body)).clientcode === 'SYNTHETIC1'
    )
      return Response.json({
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: '',
      });
    throw new Error(
      'Unexpected broker operation. Fixture prohibits live broker calls.',
    );
  };
}

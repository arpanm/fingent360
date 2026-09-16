import { z } from 'zod';
import { isIP } from 'node:net';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HoldingRowsSchema } from '@fingent360/contracts';
import { losslessKiteJson } from './kite-provider.js';
const token = z.string().regex(/^[A-Za-z0-9._~-]{8,4096}$/);
export const AngelVaultSchema = z.strictObject({
  accessToken: token,
  apiKey: z.string().min(1).max(200),
  brokerUser: z.string().min(1).max(100),
});
const quantity = z.string().regex(/^(0|[1-9]\d{0,11})$/),
  decimal = z.string().regex(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/);
const row = z.strictObject({
  tradingsymbol: z.string(),
  exchange: z.enum(['NSE', 'BSE']),
  isin: z.string(),
  t1quantity: quantity,
  realisedquantity: quantity,
  quantity,
  authorisedquantity: quantity,
  product: z.literal('DELIVERY'),
  collateralquantity: quantity.nullable(),
  collateraltype: z.string().nullable(),
  haircut: decimal,
  averageprice: decimal,
  ltp: decimal,
  symboltoken: z.string(),
  close: decimal,
  profitandloss: decimal,
  pnlpercentage: decimal,
});
export function parseAngelHoldings(raw: string) {
  const parsed = z
    .strictObject({
      status: z.literal(true),
      message: z.literal('SUCCESS'),
      errorcode: z.literal(''),
      data: z.array(row).max(200),
    })
    .parse(losslessKiteJson(raw));
  return HoldingRowsSchema.parse(
    parsed.data.map((r) => {
      if (
        r.realisedquantity !== r.quantity ||
        r.t1quantity !== '0' ||
        (r.collateralquantity ?? '0') !== '0'
      )
        throw new BadRequestException(
          'Broker holdings are unsettled or pledged. Use reviewed file import.',
        );
      if (
        !/^(0|[1-9]\d{0,12})(\.\d{1,8})?$/.test(r.averageprice) ||
        !/[1-9]/.test(r.averageprice)
      )
        throw new BadRequestException(
          'Broker average cost is missing or unsupported.',
        );
      const [whole, fraction = ''] = r.averageprice.split('.'),
        scale = 10n ** BigInt(fraction.length),
        cost =
          BigInt(r.quantity) *
          (BigInt(whole!) * scale + BigInt(fraction)) *
          100n;
      return {
        isin: r.isin,
        quantity: r.quantity,
        totalCostMinor: ((cost + scale / 2n) / scale).toString(),
      };
    }),
  );
}
async function bounded(response: Response) {
  if (!response.ok || !response.body)
    throw new ServiceUnavailableException(
      'Angel One connection is unavailable or expired.',
    );
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.length;
      if (total > 2000000)
        throw new ServiceUnavailableException(
          'Broker response exceeded the size limit.',
        );
      parts.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts).toString('utf8');
}
export class AngelProvider {
  constructor(
    private readonly apiKey: string,
    private readonly localIp: string,
    private readonly publicIp: string,
    private readonly mac: string,
  ) {}
  assertConfigured() {
    if (
      !this.apiKey ||
      !isIP(this.localIp) ||
      !isIP(this.publicIp) ||
      !/^([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}$/.test(this.mac)
    )
      throw new ServiceUnavailableException(
        'Configure the registered publisher app and truthful deployment network headers.',
      );
  }
  private headers(accessToken: string) {
    this.assertConfigured();
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-PrivateKey': this.apiKey,
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': this.localIp,
      'X-ClientPublicIP': this.publicIp,
      'X-MACAddress': this.mac,
      Authorization: `Bearer ${token.parse(accessToken)}`,
    };
  }
  // Publisher returns an access token. Verify it using the broker profile endpoint;
  // do not invent an authorization-code exchange or collect PIN/TOTP credentials.
  async exchange(authToken: string) {
    const raw = await bounded(
      await fetch(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getProfile',
        {
          headers: this.headers(authToken),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      ),
    );
    const list = z.union([z.array(z.string()), z.string()]);
    const parsed = z
      .strictObject({
        status: z.literal(true),
        message: z.literal('SUCCESS'),
        errorcode: z.literal(''),
        data: z.strictObject({
          clientcode: z.string().min(1),
          name: z.string(),
          email: z.string(),
          mobileno: z.string(),
          exchanges: list,
          products: list,
          lastlogintime: z.string(),
          brokerid: z.string(),
        }),
      })
      .parse(JSON.parse(raw));
    return AngelVaultSchema.parse({
      accessToken: authToken,
      apiKey: this.apiKey,
      brokerUser: parsed.data.clientcode,
    });
  }
  async holdings(vault: z.infer<typeof AngelVaultSchema>) {
    if (vault.apiKey !== this.apiKey)
      throw new ServiceUnavailableException(
        'Angel One application changed. Reconnect.',
      );
    return bounded(
      await fetch(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/portfolio/v1/getHolding',
        {
          headers: this.headers(vault.accessToken),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      ),
    );
  }
  async revoke(vault: z.infer<typeof AngelVaultSchema>) {
    if (vault.apiKey !== this.apiKey)
      throw new ServiceUnavailableException(
        'Original broker app is required for remote logout.',
      );
    const raw = await bounded(
      await fetch(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/logout',
        {
          method: 'POST',
          headers: this.headers(vault.accessToken),
          body: JSON.stringify({ clientcode: vault.brokerUser }),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      ),
    );
    z.strictObject({
      status: z.literal(true),
      message: z.literal('SUCCESS'),
      errorcode: z.literal(''),
      data: z.literal(''),
    }).parse(JSON.parse(raw));
  }
}
export function angelExpiry(now = new Date()) {
  const india = new Date(now.getTime() + 330 * 60000);
  return new Date(
    Date.UTC(
      india.getUTCFullYear(),
      india.getUTCMonth(),
      india.getUTCDate() + 1,
    ) -
      330 * 60000,
  ).toISOString();
}

import { z } from 'zod';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HoldingRowsSchema } from '@fingent360/contracts';
import { losslessKiteJson } from './kite-provider.js';
const credential = z.string().regex(/^[A-Za-z0-9._~-]{8,4096}$/);
export const UpstoxVaultSchema = z.strictObject({
  accessToken: credential,
  apiKey: z.string().min(1).max(200),
  brokerUser: z.string().min(1).max(100),
});
const quantity = z.string().regex(/^(0|[1-9]\d{0,11})$/),
  decimal = z.string().regex(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/);
const Holding = z.strictObject({
  isin: z.string(),
  cnc_used_quantity: quantity,
  collateral_type: z.string(),
  company_name: z.string(),
  haircut: decimal,
  product: z.literal('D'),
  quantity,
  trading_symbol: z.string(),
  tradingsymbol: z.string().optional(),
  last_price: decimal,
  close_price: decimal,
  pnl: decimal,
  day_change: decimal,
  day_change_percentage: decimal,
  instrument_token: z.string(),
  average_price: decimal,
  collateral_quantity: quantity,
  collateral_update_quantity: quantity,
  t1_quantity: quantity,
  exchange: z.enum(['NSE', 'BSE']),
});
export function parseUpstoxHoldings(raw: string) {
  const parsed = z
    .strictObject({
      status: z.literal('success'),
      data: z.array(Holding).max(200),
    })
    .parse(losslessKiteJson(raw));
  return HoldingRowsSchema.parse(
    parsed.data.map((r) => {
      if (
        r.instrument_token !== `${r.exchange}_EQ|${r.isin}` ||
        (r.tradingsymbol !== undefined &&
          r.tradingsymbol !== r.trading_symbol) ||
        [
          r.cnc_used_quantity,
          r.collateral_quantity,
          r.collateral_update_quantity,
          r.t1_quantity,
        ].some((q) => q !== '0')
      )
        throw new BadRequestException(
          'Holdings contain unsettled, pledged, used or inconsistent identities. Use a reviewed file import.',
        );
      if (
        !/^(0|[1-9]\d{0,12})(\.\d{1,8})?$/.test(r.average_price) ||
        !/[1-9]/.test(r.average_price)
      )
        throw new BadRequestException(
          'Broker average cost is missing or uses unsupported precision.',
        );
      const [whole, fraction = ''] = r.average_price.split('.'),
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
      'Upstox connection is unavailable or expired.',
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
          'Upstox response exceeded the size limit.',
        );
      parts.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts).toString('utf8');
}
export class UpstoxProvider {
  constructor(
    private readonly apiKey: string,
    private readonly secret: string,
    private readonly redirectUri: string,
  ) {}
  async exchange(code: string) {
    z.string()
      .regex(/^[A-Za-z0-9._~-]{1,512}$/)
      .parse(code);
    const body = new URLSearchParams({
      code,
      client_id: this.apiKey,
      client_secret: this.secret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    const raw = await bounded(
      await fetch('https://api.upstox.com/v2/login/authorization/token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    );
    const parsed = z
      .strictObject({
        email: z.string().optional(),
        exchanges: z.array(z.string()).optional(),
        products: z.array(z.string()).optional(),
        broker: z.literal('UPSTOX'),
        user_id: z.string().min(1),
        user_name: z.string().optional(),
        order_types: z.array(z.string()).optional(),
        user_type: z.string().optional(),
        poa: z.boolean().optional(),
        is_active: z.literal(true),
        access_token: credential,
        extended_token: z.string().optional(),
      })
      .parse(JSON.parse(raw));
    return UpstoxVaultSchema.parse({
      accessToken: parsed.access_token,
      apiKey: this.apiKey,
      brokerUser: parsed.user_id,
    });
  }
  async holdings(vault: z.infer<typeof UpstoxVaultSchema>) {
    if (vault.apiKey !== this.apiKey)
      throw new ServiceUnavailableException(
        'Upstox application changed. Reconnect.',
      );
    return bounded(
      await fetch('https://api.upstox.com/v2/portfolio/long-term-holdings', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${vault.accessToken}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    );
  }
  async revoke(vault: z.infer<typeof UpstoxVaultSchema>) {
    const raw = await bounded(
      await fetch('https://api.upstox.com/v2/logout', {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${vault.accessToken}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    );
    z.strictObject({
      status: z.literal('success'),
      data: z.literal(true),
    }).parse(JSON.parse(raw));
  }
}
export function upstoxExpiry(now = new Date()) {
  const india = new Date(now.getTime() + 330 * 60000),
    target = new Date(
      Date.UTC(
        india.getUTCFullYear(),
        india.getUTCMonth(),
        india.getUTCDate(),
        3,
        30,
      ) -
        330 * 60000,
    );
  if (target.getTime() <= now.getTime())
    target.setUTCDate(target.getUTCDate() + 1);
  return target.toISOString();
}

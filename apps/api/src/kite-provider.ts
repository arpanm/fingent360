import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { HoldingRowsSchema } from '@fingent360/contracts';
const token = z.string().regex(/^[A-Za-z0-9_-]{8,256}$/);
export const KiteVaultSchema = z.strictObject({
  accessToken: token,
  apiKey: z.string().min(1).max(100),
  brokerUser: z.string().min(1).max(100),
});
// Quote numeric lexemes outside JSON strings before decoding; no floating-point accounting.
export function losslessKiteJson(text: string): unknown {
  if (text.length > 2000000)
    throw new BadRequestException('Broker response is too large.');
  let out = '',
    position = 0;
  while (position < text.length) {
    const ch = text[position]!;
    if (ch === '"') {
      const start = position++;
      while (position < text.length) {
        if (text[position] === '\\') {
          position += 2;
          continue;
        }
        if (text[position++] === '"') break;
      }
      out += text.slice(start, position);
    } else if (ch === '-' || /\d/.test(ch)) {
      const found = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
        text.slice(position),
      );
      if (!found) throw new BadRequestException('Unreadable broker response.');
      out += JSON.stringify(found[0]);
      position += found[0].length;
    } else {
      out += ch;
      position++;
    }
  }
  return JSON.parse(out);
}
const quantity = z.string().regex(/^(0|[1-9]\d{0,11})$/),
  decimal = z.string().regex(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/);
const row = z.strictObject({
  tradingsymbol: z.string(),
  exchange: z.enum(['NSE', 'BSE']),
  instrument_token: quantity,
  isin: z.string(),
  product: z.literal('CNC'),
  price: decimal,
  quantity,
  used_quantity: quantity,
  t1_quantity: quantity,
  realised_quantity: quantity,
  authorised_quantity: quantity,
  authorised_date: z.string(),
  authorisation: z.record(z.string(), z.unknown()).optional(),
  opening_quantity: quantity,
  short_quantity: quantity.optional(),
  collateral_quantity: quantity,
  collateral_type: z.string().nullable(),
  discrepancy: z.boolean(),
  average_price: decimal,
  last_price: decimal,
  close_price: decimal,
  pnl: decimal,
  day_change: decimal,
  day_change_percentage: decimal,
  mtf: z
    .strictObject({
      quantity,
      used_quantity: quantity,
      average_price: decimal,
      value: decimal,
      initial_margin: decimal,
    })
    .optional(),
});
export function parseKiteHoldings(raw: string) {
  const parsed = z
    .strictObject({ status: z.literal('success'), data: z.array(row).max(200) })
    .parse(losslessKiteJson(raw));
  return HoldingRowsSchema.parse(
    parsed.data.map((r) => {
      if (
        r.discrepancy ||
        r.quantity !== r.realised_quantity ||
        r.quantity !== r.opening_quantity ||
        [
          r.used_quantity,
          r.t1_quantity,
          r.collateral_quantity,
          r.short_quantity ?? '0',
          r.mtf?.quantity ?? '0',
          r.mtf?.used_quantity ?? '0',
        ].some((q) => q !== '0')
      )
        throw new BadRequestException(
          'Broker holdings include unsettled, sold, pledged, funded or discrepant rows. Use a reviewed file import instead.',
        );
      if (!/^(0|[1-9]\d{0,12})(\.\d{1,8})?$/.test(r.average_price))
        throw new BadRequestException(
          'Broker average cost precision is unsupported.',
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
      'Broker connection is unavailable or expired. Reconnect or retry.',
    );
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 2000000)
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
export class KiteProvider {
  constructor(
    private readonly apiKey: string,
    private readonly secret: string,
  ) {}
  async exchange(requestToken: string) {
    token.parse(requestToken);
    const body = new URLSearchParams({
      api_key: this.apiKey,
      request_token: requestToken,
      checksum: createHash('sha256')
        .update(this.apiKey + requestToken + this.secret)
        .digest('hex'),
    });
    const raw = await bounded(
      await fetch('https://api.kite.trade/session/token', {
        method: 'POST',
        headers: {
          'X-Kite-Version': '3',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    );
    const parsed = z
      .strictObject({
        status: z.literal('success'),
        data: z.strictObject({
          access_token: token,
          user_id: z.string().min(1),
          api_key: z.literal(this.apiKey),
          broker: z.literal('ZERODHA'),
          user_type: z.string().optional(),
          email: z.string().optional(),
          user_name: z.string().optional(),
          user_shortname: z.string().optional(),
          exchanges: z.array(z.string()).optional(),
          products: z.array(z.string()).optional(),
          order_types: z.array(z.string()).optional(),
          avatar_url: z.string().nullable().optional(),
          public_token: z.string().optional(),
          enctoken: z.string().optional(),
          refresh_token: z.string().nullable().optional(),
          silo: z.string().optional(),
          login_time: z.string().optional(),
          meta: z.strictObject({ demat_consent: z.string() }).optional(),
        }),
      })
      .parse(JSON.parse(raw));
    return KiteVaultSchema.parse({
      accessToken: parsed.data.access_token,
      brokerUser: parsed.data.user_id,
      apiKey: this.apiKey,
    });
  }
  async holdings(vault: z.infer<typeof KiteVaultSchema>) {
    if (vault.apiKey !== this.apiKey)
      throw new ServiceUnavailableException(
        'Kite application changed. Reconnect.',
      );
    return bounded(
      await fetch('https://api.kite.trade/portfolio/holdings', {
        headers: {
          'X-Kite-Version': '3',
          Authorization: `token ${vault.apiKey}:${vault.accessToken}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    );
  }
  async revoke(vault: z.infer<typeof KiteVaultSchema>) {
    const query = new URLSearchParams({
      api_key: vault.apiKey,
      access_token: vault.accessToken,
    });
    const raw = await bounded(
      await fetch('https://api.kite.trade/session/token?' + query, {
        method: 'DELETE',
        headers: { 'X-Kite-Version': '3' },
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
export function kiteExpiry(now = new Date()) {
  const india = new Date(now.getTime() + 330 * 60000);
  const date = new Date(
    Date.UTC(
      india.getUTCFullYear(),
      india.getUTCMonth(),
      india.getUTCDate() + 1,
      0,
      30,
    ),
  );
  return date.toISOString();
}

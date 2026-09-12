import { z } from 'zod';
import { MacroValueSchema, type MacroIndicator } from '@fingent360/contracts';

export const macroSources = [
  {
    indicator: 'NY.GDP.MKTP.KD.ZG' as const,
    title: 'India GDP growth',
    explanation:
      'Annual growth in real GDP. This is historical macroeconomic context, not a forecast or an equity return.',
    attribution:
      'The World Bank: World Development Indicators: national statistical organizations/central banks, OECD and World Bank staff estimates.',
  },
  {
    indicator: 'FP.CPI.TOTL.ZG' as const,
    title: 'India consumer-price inflation',
    explanation:
      'Annual change in consumer prices. This annual series is not the latest monthly CPI release and does not measure your personal inflation.',
    attribution:
      'The World Bank: World Development Indicators: International Monetary Fund, International Financial Statistics.',
  },
].map((source) => ({
  ...source,
  sourceUrl: `https://data.worldbank.org/indicator/${source.indicator}?locations=IN`,
  apiUrl: `https://api.worldbank.org/v2/country/IND/indicator/${source.indicator}?format=json&source=2&per_page=100&date=2000:${new Date().getUTCFullYear()}`,
  license: 'CC BY 4.0' as const,
  termsUrl: 'https://data.worldbank.org/summary-terms-of-use',
  rightsReviewedAt: '2026-09-12',
}));
export class ProviderError extends Error {}

// JSON reviver context.source preserves the exact numeric lexeme before Number
// rounding. Monetary code never receives a binary floating-point approximation.
export function parseProviderJson(text: string): unknown {
  const reviver = (
    _key: string,
    value: unknown,
    context?: { source?: string },
  ) => {
    if (typeof value === 'number') {
      if (!context?.source)
        throw new ProviderError(
          'Node runtime cannot preserve source decimals. Use the supported Node version.',
        );
      return { numericLexeme: context.source };
    }
    return value;
  };
  try {
    return JSON.parse(text, reviver);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      'Provider returned invalid JSON; no observations were promoted.',
    );
  }
}
const NumericToken = z.strictObject({ numericLexeme: z.string().max(100) });
const IntegerToken = z
  .union([NumericToken.transform((n) => n.numericLexeme), z.string()])
  .pipe(z.string().regex(/^\d{1,6}$/))
  .transform(Number);
const Header = z.strictObject({
  page: IntegerToken,
  pages: IntegerToken,
  per_page: IntegerToken,
  total: IntegerToken,
  sourceid: z.string(),
  lastupdated: z.iso.date(),
});
const Row = z.strictObject({
  indicator: z.strictObject({ id: z.string(), value: z.string() }),
  country: z.strictObject({ id: z.string(), value: z.string() }),
  countryiso3code: z.string(),
  date: z.string().regex(/^\d{4}$/),
  value: NumericToken.nullable(),
  unit: z.string(),
  obs_status: z.string(),
  decimal: IntegerToken,
});
const Envelope = z.tuple([Header, z.array(Row).max(100)]);
export function normalizeDecimal(lexeme: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(lexeme);
  if (!match) throw new ProviderError('Provider value is not a decimal.');
  const sign = match[1] ?? '';
  const integer = match[2] ?? '0';
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? '0');
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 30)
    throw new ProviderError(
      'Provider decimal exponent exceeds supported precision.',
    );
  const digits = integer + fraction;
  const point = integer.length + exponent;
  const expanded =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  let [whole = '0', decimal = ''] = expanded.split('.');
  whole = whole.replace(/^0+(?=\d)/, '');
  decimal = decimal.replace(/0+$/, '');
  const value = `${sign && /[1-9]/.test(whole + decimal) ? '-' : ''}${whole}${decimal ? `.${decimal}` : ''}`;
  const parsed = MacroValueSchema.safeParse(value);
  if (!parsed.success)
    throw new ProviderError('Provider decimal exceeds supported precision.');
  return parsed.data;
}
export function parseWorldBank(
  body: string,
  indicator: MacroIndicator,
  currentYear = new Date().getUTCFullYear(),
) {
  const parsed = Envelope.safeParse(parseProviderJson(body));
  if (!parsed.success)
    throw new ProviderError(
      'Provider schema changed or contains unsupported fields; raw response quarantined.',
    );
  const [header, rows] = parsed.data;
  if (
    header.page !== 1 ||
    header.pages !== 1 ||
    header.total !== rows.length ||
    header.sourceid !== '2' ||
    !rows.length
  )
    throw new ProviderError(
      'Provider response is incomplete or from an unexpected dataset.',
    );
  const seen = new Set<number>();
  const observations = rows.map((row) => {
    const year = Number(row.date);
    if (
      row.indicator.id !== indicator ||
      row.countryiso3code !== 'IND' ||
      row.country.id !== 'IN' ||
      year < 2000 ||
      year > 2100 ||
      seen.has(year)
    )
      throw new ProviderError(
        'Provider returned unexpected identity, period or duplicate rows.',
      );
    seen.add(year);
    if (row.unit !== '' || row.obs_status !== '')
      throw new ProviderError(
        'Provider has nonstandard units or observation status; review required.',
      );
    if (year > currentYear && row.value !== null)
      throw new ProviderError('Future observed data cannot be promoted.');
    return {
      year,
      value:
        row.value === null ? null : normalizeDecimal(row.value.numericLexeme),
    };
  });
  return { providerUpdatedAt: header.lastupdated, observations };
}
export async function fetchWorldBank(indicator: MacroIndicator) {
  const source = macroSources.find((item) => item.indicator === indicator);
  if (!source) throw new ProviderError('Unsupported indicator.');
  let response: Response;
  try {
    response = await fetch(source.apiUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ProviderError(
      'World Bank could not be reached. Retry later; saved observations are unchanged.',
    );
  }
  if (!response.ok)
    throw new ProviderError(
      `World Bank returned HTTP ${response.status}. Retry later; saved observations are unchanged.`,
    );
  if (!response.headers.get('content-type')?.includes('json'))
    throw new ProviderError(
      'World Bank returned an unexpected response format.',
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new ProviderError('World Bank returned an empty response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 1000000) {
        await reader.cancel();
        throw new ProviderError('Provider response exceeded the 1 MB limit.');
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError('Provider download was interrupted; retry later.');
  }
  return {
    url: source.apiUrl,
    body: Buffer.concat(chunks).toString('utf8'),
    retrievedAt: new Date().toISOString(),
  };
}

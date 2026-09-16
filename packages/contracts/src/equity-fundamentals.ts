import { z } from 'zod';

export const NSE_INDAS_HTML_PARSER = 'nse-integrated-indas-html-v1';
export function isNseIndasSource(url: string) {
  const source = new URL(url);
  return (
    source.protocol === 'https:' &&
    source.hostname === 'nsearchives.nseindia.com' &&
    !source.port &&
    !source.username &&
    !source.password &&
    !source.search &&
    !source.hash &&
    /^\/corporate\/ixbrl\/INTEGRATED_FILING_INDAS_[0-9]+_[0-9]+_iXBRL_WEB\.html$/.test(
      source.pathname,
    )
  );
}
function text(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function rows(table: string) {
  if (/<table\b/i.test(table))
    throw Error('Nested fundamental tables are unsupported.');
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1]!.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(
      (cell) => text(cell[1]!),
    ),
  );
}
function required(data: string[][], label: string) {
  const matches = data.filter((row) => row.includes(label));
  if (matches.length !== 1)
    throw Error(`Missing or duplicate financial row: ${label}`);
  const row = matches[0]!;
  return row.slice(row.indexOf(label) + 1);
}
function day(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw Error('Ind AS reporting dates must use DD-MM-YYYY.');
  return z.iso.date().parse(`${match[3]}-${match[2]}-${match[1]}`);
}
function decimal(value: string) {
  const negative = /^\([\d,.]+\)$/.test(value);
  const raw = negative ? value.slice(1, -1) : value;
  if (
    !/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d?(?:,\d{2})+,\d{3})(?:\.\d{1,8})?$/.test(
      raw,
    )
  )
    throw Error('Unsupported or missing exact financial decimal.');
  return `${negative ? '-' : ''}${raw.replaceAll(',', '')}`;
}
/** Extracts only two verified total income-statement rows; never executes HTML. */
export function parseNseIndasHtml(body: string, effectiveOn: string) {
  z.iso.date().parse(effectiveOn);
  if (
    !body ||
    body.length > 2000000 ||
    /<(?:script|iframe|object|embed)\b|<!ENTITY/i.test(body)
  )
    throw Error('Unsafe or oversized financial source.');
  const tables = [...body.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  const general = tables.filter((table) =>
    /\bclass\s*=\s*["'][^"']*\bgITable\b/.test(table[1]!),
  );
  if (general.length !== 1 || !body.includes('Financial Results Ind-AS'))
    throw Error('Unsupported NSE Integrated Ind AS layout.');
  const information = rows(general[0]![2]!);
  const scalar = (label: string) => {
    const values = required(information, label);
    if (values.length !== 1) throw Error('Financial metadata width changed.');
    return values[0]!;
  };
  const isin = z
    .string()
    .regex(/^IN[A-Z0-9]{9}[0-9]$/)
    .parse(scalar('ISIN'));
  if (scalar('Description of presentation currency') !== 'INR')
    throw Error('Only explicit INR statements are supported.');
  const scales = {
    Rupees: 'rupees',
    Thousands: 'thousands',
    Lakhs: 'lakhs',
    Crores: 'crores',
  } as const;
  const rounding = scalar('Level of rounding used in financial results');
  if (!(rounding in scales))
    throw Error('Unsupported financial rounding scale.');
  const scale = scales[rounding as keyof typeof scales];
  const start = body.indexOf('Financial Results Ind-AS');
  const result = tables.find((table) => table.index! > start);
  if (!result || !/stockExchnageTableLastColwidth/.test(result[1]!))
    throw Error('Financial result table unavailable.');
  const data = rows(result[2]!);
  const starts = required(data, 'Date of start of reporting period');
  const ends = required(data, 'Date of end of reporting period');
  const audits = required(data, 'Whether results are audited or unaudited');
  const bases = required(data, 'Nature of report standalone or consolidated');
  const revenue = required(data, 'Revenue from operations');
  const profit = required(data, 'Total profit (loss) for period');
  if (
    !starts.length ||
    starts.length > 12 ||
    [ends, audits, bases, revenue, profit].some(
      (cells) => cells.length !== starts.length,
    )
  )
    throw Error('Financial reporting columns do not reconcile.');
  const observations = starts.flatMap((value, column) => {
    const periodStart = day(value),
      periodEnd = day(ends[column]!);
    if (periodStart > periodEnd || periodEnd > effectiveOn)
      throw Error('Invalid or future financial period.');
    const audit = z.enum(['Audited', 'Unaudited']).parse(audits[column]);
    const basis = z
      .enum(['Standalone', 'Consolidated'])
      .parse(bases[column])
      .toLowerCase() as 'standalone' | 'consolidated';
    return (
      [
        ['revenue', revenue[column]!, 'Revenue from operations'],
        ['profit-after-tax', profit[column]!, 'Total profit (loss) for period'],
      ] as const
    ).map(([metric, amount, label]) => ({
      kind: 'fundamental' as const,
      isin,
      effectiveOn,
      sourceRow: data.findIndex((row) => row.includes(label)) + 1,
      metric,
      periodStart,
      periodEnd,
      basis,
      currency: 'INR' as const,
      scale,
      value: decimal(amount),
      audited: audit === 'Audited',
    }));
  });
  const unique = new Map<string, (typeof observations)[number]>();
  for (const observation of observations) {
    const key = [
      observation.isin,
      observation.metric,
      observation.periodStart,
      observation.periodEnd,
      observation.basis,
    ].join(':');
    const previous = unique.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(observation))
      throw Error('Conflicting repeated financial reporting columns.');
    if (!previous) unique.set(key, observation);
  }
  return [...unique.values()];
}

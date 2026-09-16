import {
  IndiaCpiReleaseSchema,
  IndiaCpiPointSchema,
} from '@fingent360/contracts';
import { parsePibRelease } from './research-providers.js';
import { plain, sourceHash } from './discovery-provider.js';
export function parseIndiaCpiRelease(
  body: string,
  url: string,
  retrievedAt: string,
) {
  const date = plain(body).match(
    /Posted On:\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
  );
  const monthNames = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  if (
    !date ||
    Number(date[4]) < 1 ||
    Number(date[4]) > 12 ||
    Number(date[5]) > 59 ||
    !monthNames.includes(date[2]!.toUpperCase()) ||
    Number(date[1]) < 1 ||
    Number(date[1]) >
      new Date(
        Date.UTC(
          Number(date[3]),
          monthNames.indexOf(date[2]!.toUpperCase()) + 1,
          0,
        ),
      ).getUTCDate()
  )
    throw Error('Invalid original publication timestamp.');
  const item = parsePibRelease({
    url,
    body,
    retrievedAt,
    hash: sourceHash(url, body),
  });
  if (
    !/PRESS RELEASE OF CONSUMER PRICE INDEX ON BASE 2024\s*=\s*100/i.test(
      item.title,
    )
  )
    throw Error('Only the verified CPI2024 release layout is supported.');
  const tables = [...body.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(
    (match) => match[1]!,
  );
  const matches = tables.filter(
    (table) =>
      /Provisional/i.test(plain(table)) &&
      /Final/i.test(plain(table)) &&
      /Inflation \(%\)/i.test(plain(table)) &&
      /CPI \(General\)/i.test(plain(table)),
  );
  if (matches.length !== 1)
    throw Error('The national summary table is missing or ambiguous.');
  const rows = [...matches[0]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (row) =>
      [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        plain(cell[1]!).trim(),
      ),
  );
  if (
    rows.length !== 6 ||
    rows[0]?.length !== 3 ||
    rows[1]?.join('|') !== 'Rural|Urban|Combined|Rural|Urban|Combined' ||
    rows[2]?.length !== 8 ||
    rows[4]?.length !== 8 ||
    rows[2][0] !== 'Inflation (%)' ||
    rows[4][0] !== 'Index' ||
    rows[2][1] !== 'CPI (General)' ||
    rows[4][1] !== 'CPI (General)'
  )
    throw Error('Unsupported CPI table columns; retain for investigation.');
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const points = [0, 1].map((i) => {
    const heading = rows[0]![i + 1]!.match(
      /^([A-Za-z]+),\s*(20\d{2})\s*\((Provisional|Final)\)$/,
    );
    if (!heading || !months.includes(heading[1]!))
      throw Error('Missing CPI reference period/status.');
    return IndiaCpiPointSchema.parse({
      period: `${heading[2]}-${String(months.indexOf(heading[1]!) + 1).padStart(2, '0')}`,
      index: rows[4]![i === 0 ? 4 : 7],
      inflation: rows[2]![i === 0 ? 4 : 7],
      status: heading[3]!.toLowerCase(),
    });
  });
  if (points.some((point) => point.period > item.publishedAt.slice(0, 7)))
    throw Error('Reference period follows publication.');
  if (
    points[0]!.period <= points[1]!.period ||
    points[0]!.status !== 'provisional' ||
    points[1]!.status !== 'final'
  )
    throw Error('Unsupported release chronology.');
  return IndiaCpiReleaseSchema.parse({
    sourceUrl: url,
    publishedAt: item.publishedAt,
    title: item.title,
    points,
  });
}

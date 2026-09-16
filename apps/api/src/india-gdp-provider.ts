import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { MongoClient } from 'mongodb';
import {
  INDIA_GDP_INDEX,
  INDIA_GDP_PARSER,
  IndiaGdpReleaseSchema,
  IndiaGdpEditionSchema,
  IndiaGdpInputSchema,
} from '@fingent360/contracts';
import { parsePibArchiveMetadata } from './india-gdp-archive-provider.js';
import { plain, sourceHash } from './discovery-provider.js';
import { boundedOfficial, parsePibRelease } from './research-providers.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const hash = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
export function parseIndiaGdpRelease(
  body: string,
  url: string,
  retrievedAt: string,
) {
  const text = plain(
    body.replace(/<(script|style|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi, ''),
  );
  const date = text.match(
    /Posted On:\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
  );
  const months = [
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
  const archived = new URL(url).hostname === 'archive.pib.gov.in';
  if (
    !archived &&
    (!date ||
      Number(date[4]) < 1 ||
      Number(date[4]) > 12 ||
      Number(date[5]) > 59 ||
      !months.includes(date[2]!.toUpperCase()) ||
      Number(date[1]) < 1 ||
      Number(date[1]) >
        new Date(
          Date.UTC(
            Number(date[3]),
            months.indexOf(date[2]!.toUpperCase()) + 1,
            0,
          ),
        ).getUTCDate())
  )
    throw Error('Invalid original PIB publication timestamp.');
  const item = archived
    ? parsePibArchiveMetadata(body)
    : parsePibRelease({ url, body, retrievedAt, hash: sourceHash(url, body) });
  if (
    item.publishedAt > retrievedAt ||
    !/QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT/i.test(item.title) ||
    !/Ministry of Statistics|National Statistics Office/i.test(text) ||
    !/Benchmark[-– ]Indicator methodology/i.test(text)
  )
    throw Error(
      'Unsupported original quarterly GDP title, producer or method.',
    );
  const bases = [
    ...new Set(
      [
        ...text.matchAll(
          /(?:Constant\s*\((2011-12|2022-23)\)|base year\s*(2011-12|2022-23))/gi,
        ),
      ].map((match) => match[1] ?? match[2]),
    ),
  ];
  if (bases.length !== 1)
    throw Error(
      'Missing or ambiguous GDP price base; never splice base revisions.',
    );
  const pattern =
    /Real GDP or GDP at Constant Prices in (Q[1-4]) of FY (20\d{2}-\d{2}) is estimated at ₹\s*(\d+\.\d{2}) lakh crore, against ₹\s*(\d+\.\d{2}) lakh crore in (Q[1-4]) of FY (20\d{2}-\d{2}), (?:showing|registering) a growth rate of (-?\d+\.\d)%\./g;
  const matches = [
    ...new Map(
      [...text.matchAll(pattern)].map((match) => [match[0], match]),
    ).values(),
  ];
  if (matches.length !== 1)
    throw Error('Quarterly real GDP headline is missing or ambiguous.');
  const value = matches[0]!;
  if (value[1] !== value[5])
    throw Error('GDP comparison uses different fiscal quarters.');
  const ordinal = ['FIRST', 'SECOND', 'THIRD', 'FOURTH'][
    Number(value[1]!.slice(1)) - 1
  ];
  if (
    !ordinal ||
    !item.title.toUpperCase().includes(`${ordinal} QUARTER`) ||
    !item.title.includes(value[2]!)
  )
    throw Error(
      'GDP headline quarter does not match its original release title.',
    );
  const startYear = Number(value[2]!.slice(0, 4)),
    quarter = Number(value[1]!.slice(1));
  const endYear = quarter === 4 ? startYear + 1 : startYear;
  const endMonth =
    quarter === 1 ? 6 : quarter === 2 ? 9 : quarter === 3 ? 12 : 3;
  const endDay = new Date(Date.UTC(endYear, endMonth, 0))
    .toISOString()
    .slice(0, 10);
  if (endDay > item.publishedAt.slice(0, 10))
    throw Error('Reference quarter is after publication.');
  const calendar = [
    ...new Set(
      [
        ...text.matchAll(
          /next release of Quarterly GDP estimates[\s\S]{0,180}?is scheduled on (\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(20\d{2})/gi,
        ),
      ].map((match) => JSON.stringify([match[1], match[2], match[3]])),
    ),
  ];
  if (calendar.length > 1) throw Error('Conflicting next-release dates.');
  let nextRelease = null;
  if (calendar[0]) {
    const [d, m, y] = JSON.parse(calendar[0]) as string[];
    const month =
      [
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
      ].findIndex((name) => name.toLowerCase() === m!.toLowerCase()) + 1;
    if (!month) throw Error('Unknown calendar month.');
    nextRelease = {
      plannedOn: `${y}-${String(month).padStart(2, '0')}-${d!.padStart(2, '0')}`,
      precision: 'day' as const,
      actualOn: null,
    };
    if (nextRelease.plannedOn <= item.publishedAt.slice(0, 10))
      throw Error('Next scheduled release does not follow this publication.');
  }
  return IndiaGdpReleaseSchema.parse({
    sourceUrl: url,
    publishedAt: item.publishedAt,
    title: item.title,
    point: {
      fiscalYear: value[2],
      quarter: value[1],
      previousFiscalYear: value[6],
      baseYear: bases[0],
      measure: 'real-gdp',
      priceBasis: 'constant-prices',
      unit: 'INR-lakh-crore',
      growthBasis: 'year-on-year-percent',
      value: value[3],
      previousYearValue: value[4],
      growthPercent: value[7],
      method: 'benchmark-indicator',
      status: 'reported-quarterly-estimate',
    },
    nextRelease,
  });
}
export function discoverIndiaGdp(body: string) {
  if (!/All Releases/i.test(plain(body)))
    throw Error('Official PIB index layout changed.');
  const links = new Set<string>();
  for (const group of body.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi,
  )) {
    if (!/Ministry of Statistics/i.test(plain(group[1]!))) continue;
    for (const link of group[2]!.matchAll(
      /<a\b[^>]*href=['"]\/PressReleaseDetail\.aspx\?PRID=(\d{5,12})['"][^>]*>([\s\S]*?)<\/a>/gi,
    ))
      if (
        /QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT/i.test(plain(link[2]!))
      )
        links.add(
          `https://www.pib.gov.in/PressReleasePage.aspx?PRID=${link[1]}&lang=1&reg=3`,
        );
  }
  if (links.size > 8)
    throw Error(
      'Unexpected GDP listing size; inspect original before capture.',
    );
  return [...links];
}
export async function captureScheduledIndiaGdp(
  pool: pg.Pool,
  mongo: MongoClient,
) {
  const gate = await pool.query(
    'SELECT rights_evidence FROM india_gdp_gate WHERE id=true',
  );
  const rights = gate.rows[0]?.rights_evidence;
  if (typeof rights !== 'string' || rights.trim().length < 20)
    throw Error('India GDP source rights are not configured.');
  const index = await boundedOfficial(INDIA_GDP_INDEX);
  await mongo
    .db()
    .collection<{ _id: string; value: unknown }>('india_gdp_indexes')
    .updateOne(
      { _id: hash(index) },
      { $setOnInsert: { value: index } },
      { upsert: true },
    );
  for (const url of discoverIndiaGdp(index.body)) {
    const raw = await boundedOfficial(url),
      digest = hash({ url, body: raw.body }),
      id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const input = IndiaGdpInputSchema.parse({
        requestId: id,
        releaseUrl: url,
        releaseHtml: raw.body,
        rightsEvidence: rights,
        rightsConfirmed: true,
      }),
      fingerprint = hash(input),
      sourceDigest = hash(input);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        id,
      ]);
      const admitted = await c.query(
        "SELECT g.rights_evidence FROM india_gdp_gate g JOIN research_auto_schedules s ON s.source_id='india-gdp' WHERE g.id=true AND s.enabled FOR SHARE OF g,s",
      );
      if (admitted.rows[0]?.rights_evidence !== rights)
        throw Error('India GDP schedule or source permission changed.');
      const old = await c.query(
        'SELECT id FROM india_macro_editions WHERE id=$1 UNION ALL SELECT id FROM india_macro_attempts WHERE id=$1',
        [id],
      );
      if (!old.rows.length) {
        await mongo
          .db()
          .collection<{ _id: string; value: unknown }>('india_macro_raw')
          .updateOne(
            { _id: sourceDigest },
            { $setOnInsert: { value: input } },
            { upsert: true },
          );
        let edition: unknown;
        let reason: string | null = null;
        try {
          edition = IndiaGdpEditionSchema.parse({
            id,
            parser: INDIA_GDP_PARSER,
            hash: sourceDigest,
            retrievedAt: raw.retrievedAt,
            rightsEvidence: rights,
            ...parseIndiaGdpRelease(raw.body, url, raw.retrievedAt),
          });
        } catch (cause) {
          reason = (
            cause instanceof Error
              ? cause.message
              : 'Unsupported original GDP release.'
          ).slice(0, 3000);
        }
        if (reason)
          await c.query(
            'INSERT INTO india_macro_attempts(id,hash,reason,actor_id,fingerprint) VALUES($1,$2,$3,$4,$5)',
            [id, sourceDigest, reason, 'scheduled-india-gdp', fingerprint],
          );
        else
          await c.query(
            "INSERT INTO india_macro_editions(id,kind,fingerprint,actor_id,payload) VALUES($1,'gdp',$2,$3,$4)",
            [id, fingerprint, 'scheduled-india-gdp', edition],
          );
      }
      await c.query('COMMIT');
    } catch (cause) {
      await c.query('ROLLBACK');
      throw cause;
    } finally {
      c.release();
    }
  }
  return hash(index);
}

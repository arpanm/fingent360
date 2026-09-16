import { BEA_GDP_INDEX, discoverBeaGdpOriginals } from '@fingent360/contracts';
import {
  originalGdpItem,
  BEA_GDP_ORIGINAL_RIGHTS,
} from './bea-gdp-original-provider.js';
import {
  FED_POLICY_HISTORY_URLS,
  FED_POLICY_HISTORY_RIGHTS,
  parseHistoricalFedPolicy,
} from './fed-policy-provider.js';
import {
  BEA_GDP_HISTORY_URLS,
  BEA_GDP_HISTORY_RIGHTS,
  parseHistoricalBeaGdp,
} from './bea-gdp-history-provider.js';
import {
  FIU_HISTORY_URLS,
  parseHistoricalFiu,
} from './fiu-history-provider.js';
import {
  BEA_FEED,
  BEA_NAME,
  BEA_TERMS,
  BEA_RIGHTS,
} from '@fingent360/contracts';
import { parseBeaRss } from './bea-provider.js';
import { parseProviderJson, normalizeDecimal } from './world-bank.js';
import { z } from 'zod';
import {
  FeedItemSchema,
  type FeedItem,
  type ResearchSource,
} from '@fingent360/contracts';
import {
  parseFedRss,
  FED_FEED,
  FED_RIGHTS,
  parseOfficialRss,
  plain,
  sourceHash,
} from './discovery-provider.js';
export interface ResearchRaw {
  url: string;
  body: string;
  retrievedAt: string;
  hash: string;
  items: FeedItem[];
}
const ECB_TERMS =
  'https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html';
const PIB_TERMS =
  'https://www.pib.gov.in/content/3604_2_CopyrightPolicy.aspx?lang=1&reg=3';
const WB_TERMS =
  'https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets';
const ecbRights = `Accurate attributed ECB information, available free at the original source. No named-author papers, images, logos or third-party content. ${ECB_TERMS}`;
const pibRights = `Press Information Bureau, Government of India; accurate attributed reproduction permitted without prior approval, excluding third-party content. ${PIB_TERMS}`;
function descriptor(
  id: string,
  name: string,
  region: 'india' | 'global',
  homeUrl: string,
  feedUrl: string | null,
  termsUrl: string,
  rights: string,
  topics: string[],
  access: ResearchSource['access'] = 'enabled',
  accessNote = 'Fixed public adapter; publications require operator review.',
): ResearchSource {
  return {
    id,
    name,
    region,
    homeUrl,
    feedUrl,
    termsUrl,
    rights,
    topics,
    access,
    accessNote,
    description: name + ' official educational research context.',
    publishedCount: 0,
    latestPublishedAt: null,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastRunStatus: null,
    lastMessage: '',
  };
}
export const researchSources: ResearchSource[] = [
  descriptor(
    'pib-fiu-history',
    'PIB historical FIU enforcement disclosure',
    'india',
    'https://www.pib.gov.in',
    FIU_HISTORY_URLS[0]!,
    PIB_TERMS,
    pibRights,
    ['Governance', 'India'],
    'enabled',
    'Fixed2024 government release; historical subject-specific context, drafts require review.',
  ),
  descriptor(
    'bea-gdp-original',
    'BEA original GDP publications',
    'global',
    'https://www.bea.gov',
    BEA_GDP_INDEX,
    'https://www.bea.gov/help/faq/147',
    BEA_GDP_ORIGINAL_RIGHTS,
    ['GDP', 'United States'],
    'enabled',
    'Discovers original releases; retains exact publication vintages for review.',
  ),
  descriptor(
    'bea-gdp-history',
    'BEA original GDP estimate vintages',
    'global',
    'https://www.bea.gov',
    BEA_GDP_HISTORY_URLS[0]!,
    'https://www.bea.gov/about/policies-and-information',
    BEA_GDP_HISTORY_RIGHTS,
    ['GDP', 'United States'],
    'enabled',
    'Two fixed2025Q2 releases; historical vintage revision, drafts require review.',
  ),
  descriptor(
    'fed-policy-history',
    'Federal Reserve historical policy decisions',
    'global',
    'https://www.federalreserve.gov',
    FED_POLICY_HISTORY_URLS[0],
    'https://www.federalreserve.gov/disclaimer.htm',
    FED_POLICY_HISTORY_RIGHTS,
    ['Federal Reserve releases', 'Historical policy decisions'],
    'enabled',
    'Two fixed 2024 statements; historical context only, drafts require review.',
  ),
  descriptor(
    'bea',
    BEA_NAME,
    'global',
    'https://www.bea.gov',
    BEA_FEED,
    BEA_TERMS,
    BEA_RIGHTS,
    ['Global economy', 'Growth', 'Trade'],
    'enabled',
    'First-party /news/ release headlines only. Descriptions, numerical fields, media and legacy archive links are excluded; publication requires review.',
  ),
  descriptor(
    'fed',
    'Federal Reserve Board',
    'global',
    'https://www.federalreserve.gov',
    FED_FEED,
    'https://www.federalreserve.gov/disclaimer.htm',
    FED_RIGHTS,
    ['Rates', 'Banking', 'Policy'],
  ),
  descriptor(
    'ecb-press',
    'European Central Bank — press',
    'global',
    'https://www.ecb.europa.eu',
    'https://www.ecb.europa.eu/rss/press.html',
    ECB_TERMS,
    ecbRights,
    ['Rates', 'Global economy'],
  ),
  descriptor(
    'ecb-statistics',
    'European Central Bank — statistics',
    'global',
    'https://www.ecb.europa.eu',
    'https://www.ecb.europa.eu/rss/statpress.html',
    ECB_TERMS,
    ecbRights,
    ['Global economy'],
  ),
  descriptor(
    'pib',
    'Press Information Bureau',
    'india',
    'https://www.pib.gov.in',
    'https://www.pib.gov.in/AllRel.aspx?lang=1&reg=3',
    PIB_TERMS,
    pibRights,
    ['India', 'Growth', 'Trade', 'Policy'],
    'enabled',
    'Official English ministry index and release HTML; advertised RSS currently empty. Only finance/statistics/commerce/economic transport ministries selected.',
  ),
  descriptor(
    'world-bank',
    'World Bank',
    'india',
    'https://data.worldbank.org',
    'https://api.worldbank.org/v2/country/IND/indicator/SL.UEM.TOTL.ZS?format=json&per_page=100',
    WB_TERMS,
    `World Bank WDI; CC BY 4.0 attribution. ${WB_TERMS}`,
    ['India', 'Annual data', 'Jobs', 'Trade', 'Growth'],
  ),
  descriptor(
    'glossary',
    'Fingent360 editorial glossary',
    'global',
    'https://www.federalreserve.gov',
    null,
    'https://www.federalreserve.gov/disclaimer.htm',
    'Original sourced educational definitions; not provider news.',
    ['Basics', 'Investor basics'],
  ),
  descriptor(
    'rbi',
    'Reserve Bank of India',
    'india',
    'https://www.rbi.org.in',
    'https://www.rbi.org.in/pressreleases_rss.xml',
    'https://www.rbi.org.in/Scripts/Disclaimer.aspx',
    'Caching and deep linking require permission.',
    ['India', 'Rates'],
    'review_required',
    'RSS accessible; permission is not established. No ingestion.',
  ),
  descriptor(
    'sebi',
    'SEBI',
    'india',
    'https://www.sebi.gov.in',
    'https://www.sebi.gov.in/sebirss.xml',
    'https://www.sebi.gov.in/hindi/website-policy.html',
    'Prior email permission required for reproduction.',
    ['India', 'Policy'],
    'review_required',
    'Permission missing; ordinary local DNS request also failed. No ingestion.',
  ),
  descriptor(
    'boe',
    'Bank of England',
    'global',
    'https://www.bankofengland.co.uk',
    null,
    'https://www.bankofengland.co.uk/legal',
    'General press reuse limited to personal/internal noncommercial purposes.',
    ['Rates'],
    'review_required',
    'Public redistribution requires additional authorization.',
  ),
  descriptor(
    'mospi',
    'MoSPI',
    'india',
    'https://www.mospi.gov.in',
    null,
    'https://www.mospi.gov.in/copyright-policy',
    'No independently verified feed reuse terms from returned application shell.',
    ['India'],
    'blocked',
    'Candidate RSS and policy routes returned JavaScript app HTML, not verified feed/policy.',
  ),
  descriptor(
    'bls',
    'US Bureau of Labor Statistics',
    'global',
    'https://www.bls.gov',
    'https://www.bls.gov/feed/cpi.rss',
    'https://www.bls.gov/opub/copyright-information.htm',
    'Public-domain text with attribution; exclude logos/images.',
    ['Inflation'],
    'blocked',
    'Ordinary feed request returned HTTP403. No access-control bypass.',
  ),
];
export class OfficialFetchError extends Error {
  constructor(
    public readonly category: 'network' | 'http' | 'oversize' | 'incomplete',
    message: string,
  ) {
    super(message);
  }
}
export async function boundedOfficial(
  url: string,
): Promise<Omit<ResearchRaw, 'items'>> {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: 'application/xml,text/xml,text/html,application/json',
      'User-Agent': 'Fingent360 educational source reader',
    },
  }).catch(() => {
    throw new OfficialFetchError(
      'network',
      'Official request failed or timed out.',
    );
  });
  if (!response.ok)
    throw new OfficialFetchError(
      'http',
      `Official HTTP status ${response.status}.`,
    );
  if (!response.body)
    throw new OfficialFetchError(
      'incomplete',
      'Official response has no body.',
    );
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1000000)
        throw new OfficialFetchError(
          'oversize',
          'Official response exceeds 1MB.',
        );
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof OfficialFetchError) throw error;
    throw new OfficialFetchError(
      'incomplete',
      'Official response stream was interrupted.',
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
  let body: string;
  try {
    body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      Buffer.concat(chunks),
    );
  } catch {
    throw new OfficialFetchError(
      'incomplete',
      'Official response is not valid UTF-8; no complete text retained.',
    );
  }
  const retrievedAt = new Date().toISOString();
  return { url, body, retrievedAt, hash: sourceHash(url, body) };
}
export function parsePibIndex(html: string): string[] {
  const ids: string[] = [];
  for (const group of html.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi,
  )) {
    if (
      !/Ministry of (Finance|Statistics|Commerce|Railways|Road Transport|Ports)/i.test(
        plain(group[1]!),
      )
    )
      continue;
    for (const link of group[2]!.matchAll(
      /href=['"]\/PressReleaseDetail\.aspx\?PRID=(\d{5,12})['"]/gi,
    ))
      if (!ids.includes(link[1]!)) ids.push(link[1]!);
  }
  return ids.slice(0, 12);
}
export function parsePibRelease(raw: Omit<ResearchRaw, 'items'>): FeedItem {
  const clean = raw.body.replace(
    /<(script|style|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  );
  const titleMatch = clean.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  const text = plain(clean),
    date = text.match(
      /Posted On:\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    );
  if (!titleMatch || !date)
    throw Error('PIB release lacks title or explicit publication timestamp.');
  const month = [
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
  ].indexOf(date[2]!.toUpperCase());
  if (month < 0) throw Error('Invalid release month.');
  const hour =
    (Number(date[4]) % 12) + (date[6]!.toUpperCase() === 'PM' ? 12 : 0);
  const publishedAt = new Date(
    Date.UTC(Number(date[3]), month, Number(date[1]), hour, Number(date[5])) -
      19800000,
  ).toISOString();
  if (Date.parse(publishedAt) > Date.parse(raw.retrievedAt) + 86400000)
    throw Error('Future release timestamp.');
  const title = plain(titleMatch[1]!).slice(0, 500);
  const content = clean.slice(clean.indexOf('Posted On:'));
  const paragraphs = [...content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plain(match[1]!))
    .filter(
      (value) =>
        value.length > 50 &&
        /[.!?]$/.test(value) &&
        !value.includes('https://t.co/'),
    );
  const selected: string[] = [];
  let size = 0;
  for (const paragraph of paragraphs) {
    if (selected.length === 3) break;
    if (size + paragraph.length + 1 > 1000) {
      if (!selected.length) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
        for (const sentence of sentences) {
          if (size + sentence.length > 1000) break;
          selected.push(sentence.trim());
          size += sentence.length;
        }
      }
      break;
    }
    selected.push(paragraph);
    size += paragraph.length + 1;
  }
  const summary = selected.join(' ');
  if (!summary) throw Error('Missing PIB release text.');
  return FeedItemSchema.parse({
    id: `pib-${new URL(raw.url).searchParams.get('PRID')}`,
    version: 1,
    kind: 'news',
    title,
    summary,
    body: summary,
    topics: ['India', 'Policy'],
    publishedAt,
    effectiveLabel: 'Official release · publication time India Standard Time',
    source: {
      name: 'Press Information Bureau',
      url: raw.url,
      retrievedAt: raw.retrievedAt,
      rights: pibRights,
    },
    sourceHash: raw.hash,
    importance: 2,
    relatedIds: [],
    status: 'draft',
    correctionNote: null,
    reviewedAt: null,
  });
}
export const extraAnnualIndicators = [
  {
    id: 'SL.UEM.TOTL.ZS',
    slug: 'unemployment',
    title: 'India unemployment',
    topic: 'Jobs',
    unit: '% of total labor force (modeled ILO estimate)',
  },
  {
    id: 'NE.TRD.GNFS.ZS',
    slug: 'trade',
    title: 'India trade',
    topic: 'Trade',
    unit: '% of GDP',
  },
  {
    id: 'BX.KLT.DINV.WD.GD.ZS',
    slug: 'fdi',
    title: 'India foreign direct investment net inflows',
    topic: 'Growth',
    unit: '% of GDP',
  },
];
export function parseExtraAnnual(
  raw: Omit<ResearchRaw, 'items'>,
  indicator: (typeof extraAnnualIndicators)[number],
): FeedItem[] {
  const numeric = z.strictObject({ numericLexeme: z.string().max(100) });
  const integer = z
    .union([numeric.transform((value) => value.numericLexeme), z.string()])
    .pipe(z.string().regex(/^\d{1,6}$/))
    .transform(Number);
  const record = z.strictObject({
    indicator: z.strictObject({ id: z.string(), value: z.string() }),
    country: z.strictObject({ id: z.string(), value: z.string() }),
    countryiso3code: z.string(),
    date: z.string().regex(/^\d{4}$/),
    value: numeric.nullable(),
    unit: z.literal(''),
    obs_status: z.literal(''),
    decimal: integer,
  });
  const [header, rows] = z
    .tuple([
      z.strictObject({
        page: integer,
        pages: integer,
        per_page: integer,
        total: integer,
        sourceid: z.literal('2'),
        lastupdated: z.iso.date(),
      }),
      z.array(record).min(1).max(100),
    ])
    .parse(parseProviderJson(raw.body));
  if (
    header.page !== 1 ||
    header.pages !== 1 ||
    header.total !== rows.length ||
    header.per_page < rows.length
  )
    throw Error('Incomplete World Bank page.');
  const currentYear = new Date(raw.retrievedAt).getUTCFullYear();
  if (
    !Number.isFinite(currentYear) ||
    header.lastupdated > raw.retrievedAt.slice(0, 10)
  )
    throw Error('Invalid provider update date.');
  const seen = new Set<string>();
  const validated = rows.map((row) => {
    const year = Number(row.date);
    if (
      row.indicator.id !== indicator.id ||
      row.country.id !== 'IN' ||
      row.countryiso3code !== 'IND' ||
      year < 1960 ||
      year > 2100 ||
      seen.has(row.date) ||
      (year > currentYear && row.value !== null)
    )
      throw Error('Unexpected annual identity, period or duplicate.');
    seen.add(row.date);
    return {
      year: row.date,
      value:
        row.value === null ? null : normalizeDecimal(row.value.numericLexeme),
    };
  });
  return validated
    .filter((row) => Number(row.year) <= currentYear)
    .sort((a, b) => b.year.localeCompare(a.year))
    .slice(0, 12)
    .map(({ year, value }) => {
      const observed = value === null ? 'Unavailable' : value;
      return FeedItemSchema.parse({
        id: `wb-${indicator.slug}-${year}`,
        version: 1,
        kind: 'annual',
        title: `${indicator.title}: ${year}`,
        summary: `Reported ${year} annual value: ${observed}${value === null ? '' : ` ${indicator.unit}`}.`,
        body: `World Bank annual observation for India. ${indicator.title}: ${observed}${value === null ? '' : ` ${indicator.unit}`}. Dataset updated ${header.lastupdated}. Annual context, not a current market quote or forecast.`,
        topics: ['India', 'Annual data', indicator.topic],
        publishedAt: `${year}-12-31T00:00:00.000Z`,
        effectiveLabel: `Observation year ${year} · dataset updated ${header.lastupdated} · period-end ordering, not release date`,
        source: {
          name: 'World Bank',
          url: `https://data.worldbank.org/indicator/${indicator.id}?locations=IN`,
          retrievedAt: raw.retrievedAt,
          rights: `World Bank WDI; CC BY 4.0. ${WB_TERMS}`,
        },
        sourceHash: raw.hash,
        importance: 1,
        relatedIds: [],
        status: 'draft',
        correctionNote: null,
        reviewedAt: null,
      });
    });
}
export async function fetchResearchSource(
  id: string,
  persistRaw: (
    raw: Omit<ResearchRaw, 'items'>,
  ) => Promise<void> = async () => {},
): Promise<ResearchRaw[]> {
  const fetchAndRetain = async (url: string) => {
    const raw = await boundedOfficial(url);
    await persistRaw(raw);
    return raw;
  };
  if (id === 'fed-policy-history') {
    const records: ResearchRaw[] = [];
    for (const url of FED_POLICY_HISTORY_URLS) {
      const raw = await fetchAndRetain(url);
      records.push({ ...raw, items: [parseHistoricalFedPolicy(raw)] });
    }
    return records;
  }
  if (id === 'bea-gdp-original') {
    const index = await fetchAndRetain(BEA_GDP_INDEX);
    const records: ResearchRaw[] = [{ ...index, items: [] }];
    for (const url of discoverBeaGdpOriginals(index.body)) {
      const raw = await fetchAndRetain(url);
      records.push({ ...raw, items: [originalGdpItem(raw)] });
    }
    return records;
  }
  if (id === 'bea-gdp-history') {
    const records: ResearchRaw[] = [];
    for (const url of BEA_GDP_HISTORY_URLS) {
      const raw = await fetchAndRetain(url);
      records.push({ ...raw, items: [parseHistoricalBeaGdp(raw)] });
    }
    return records;
  }
  if (id === 'pib-fiu-history') {
    const records: ResearchRaw[] = [];
    for (const url of FIU_HISTORY_URLS) {
      const raw = await fetchAndRetain(url);
      records.push({ ...raw, items: [parseHistoricalFiu(raw)] });
    }
    return records;
  }
  if (id === 'bea') {
    const raw = await fetchAndRetain(BEA_FEED);
    return [{ ...raw, items: parseBeaRss(raw.body, raw.retrievedAt) }];
  }
  if (id === 'fed') {
    const raw = await fetchAndRetain(FED_FEED);
    return [{ ...raw, items: parseFedRss(raw.body, raw.retrievedAt) }];
  }
  if (id === 'world-bank') {
    const records: ResearchRaw[] = [];
    for (const indicator of extraAnnualIndicators) {
      const raw = await fetchAndRetain(
        `https://api.worldbank.org/v2/country/IND/indicator/${indicator.id}?format=json&per_page=100`,
      );
      records.push({ ...raw, items: parseExtraAnnual(raw, indicator) });
    }
    return records;
  }
  const source = researchSources.find(
    (s) => s.id === id && s.access === 'enabled',
  );
  if (!source?.feedUrl) throw Error('Source has no enabled adapter.');
  const raw = await fetchAndRetain(source.feedUrl);
  if (id === 'pib') {
    const ids = parsePibIndex(raw.body);
    if (!ids.length)
      throw Error(
        'No eligible economic releases in the official English index.',
      );
    const records: ResearchRaw[] = [{ ...raw, items: [] }];
    for (const release of ids) {
      const article = await fetchAndRetain(
        `https://www.pib.gov.in/PressReleasePage.aspx?PRID=${release}&lang=1&reg=3`,
      );
      records.push({ ...article, items: [parsePibRelease(article)] });
    }
    return records;
  }
  const restricted = raw.body.replace(
    /<item\b[^>]*>[\s\S]*?<\/item>/gi,
    (item) =>
      (id === 'ecb-statistics'
        ? /<link>https:\/\/www\.ecb\.europa\.eu\/+press\/stats\//i
        : /<link>https:\/\/www\.ecb\.europa\.eu\/+press\/pr\//i
      ).test(item)
        ? item
        : '',
  );
  const items = parseOfficialRss(restricted, raw.retrievedAt, {
    id,
    name: source.name,
    url: source.feedUrl,
    rights: source.rights,
    host: 'www.ecb.europa.eu',
    path: id === 'ecb-statistics' ? '/press/stats/' : '/press/pr/',
    topics: source.topics,
  });
  return [
    {
      ...raw,
      items: items.map((item) => ({
        ...item,
        sourceHash: raw.hash,
        effectiveLabel:
          'Official press headline · open original for full release',
      })),
    },
  ];
}

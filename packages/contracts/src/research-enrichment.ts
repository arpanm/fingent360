import { FeedItemSchema, type FeedItem } from './discovery.js';
import {
  ResearchContextSchema,
  sourceIdFor,
  type ResearchContext,
} from './research.js';
import {
  learningContentItems,
  learningReferences,
} from './learning-content.js';

const terms = [
  {
    id: 'diversification',
    title: 'Diversification',
    topic: 'Investor basics',
    summary:
      'Diversification spreads investments across different exposures to help manage concentration risk.',
    body: 'It does not eliminate the possibility of loss or guarantee a return. Different holdings can still respond to the same economic event.',
    url: 'https://www.investor.gov/introduction-investing/investing-basics/asset-allocation-and-diversification',
  },
  {
    id: 'basis-points',
    title: 'Basis points',
    topic: 'Rates',
    summary: 'One basis point is one hundredth of a percentage point.',
    body: 'A move from 4.00% to 4.25% is 25 basis points, or 0.25 percentage points. The example illustrates the unit; it is not a current policy rate.',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html',
  },
  {
    id: 'real-vs-nominal',
    title: 'Real and nominal values',
    topic: 'Growth',
    summary:
      'Nominal values use current prices; real measures adjust for changes in prices.',
    body: 'A rise in nominal output can reflect both prices and production. Check the unit and adjustment method before comparing reported growth measures.',
    url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',
  },
  {
    id: 'trade-balance',
    title: 'Trade balance',
    topic: 'Trade',
    summary:
      'A trade balance compares the value of exports and imports over a stated period.',
    body: 'A surplus or deficit alone is not a forecast for an exchange rate or a company. Check whether the report includes goods, services or both, and whether units and periods match.',
    url: 'https://data.worldbank.org/indicator/NE.RSB.GNFS.ZS',
  },
  {
    id: 'fdi',
    title: 'Foreign direct investment',
    topic: 'Trade',
    summary:
      'Foreign direct investment describes investment associated with a lasting interest in an enterprise in another economy.',
    body: 'FDI is distinct from a daily foreign portfolio-investor flow. Annual net inflows as a share of GDP are historical economic context, not an equity trading signal.',
    url: 'https://data.worldbank.org/indicator/BX.KLT.DINV.WD.GD.ZS',
  },
  {
    id: 'unemployment',
    title: 'Unemployment measures',
    topic: 'Jobs',
    summary:
      'An unemployment rate measures a defined unemployed population as a share of the labour force.',
    body: 'The definition, reference period and estimation method matter. Modelled international estimates may differ from a national survey release; a jobless person is not always included in the measured labour force.',
    url: 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS',
  },
  {
    id: 'data-revision',
    title: 'Data revisions',
    topic: 'Investor basics',
    summary:
      'An economic estimate can change when a provider receives additional information or updates its method.',
    body: 'Compare the original and revised editions with their dates and units. A revision is not automatically an error, and a recent retrieval date does not make an old observation a current-period value.',
    url: 'https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-country-data',
  },
  {
    id: 'cost-basis',
    title: 'Cost and market value',
    topic: 'Investor basics',
    summary:
      'Recorded cost describes what you entered paying; market value depends on an identified asset and a dated price.',
    body: 'Fingent360 keeps your entered cost separate from market value. Missing verified prices cannot be replaced with cost or an assumed return.',
    url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products',
  },
];
export function researchGlossaryItems(now: string): FeedItem[] {
  return terms.map((term) =>
    FeedItemSchema.parse({
      id: `term-${term.id}`,
      version: 1,
      kind: 'term',
      title: term.title,
      summary: term.summary,
      body: term.body,
      topics: ['Basics', 'Investor basics', term.topic].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      publishedAt: '2026-09-13T00:00:00.000Z',
      effectiveLabel: 'Educational definition · authored content',
      source: {
        name: 'Fingent360 editorial glossary',
        url: term.url,
        retrievedAt: now,
        rights:
          'Original educational explanation with primary-reference links. Not provider news, current data or investment advice.',
      },
      sourceHash: null,
      importance: 1,
      relatedIds: [],
      status: 'draft',
      correctionNote: null,
      reviewedAt: null,
    }),
  );
}
const rules: Array<{ topic: string; match: RegExp; terms: string[] }> = [
  {
    topic: 'Inflation',
    match: /\binflation|consumer prices|\bcpi\b|purchasing power/i,
    terms: ['term-inflation', 'term-data-revision'],
  },
  {
    topic: 'Rates',
    match:
      /interest rate|monetary policy|basis points|policy rate|federal funds|repo rate/i,
    terms: ['term-interest-rates', 'term-basis-points'],
  },
  {
    topic: 'Growth',
    match: /\bgdp\b|\bgrowth\b|gross domestic|production|output/i,
    terms: ['term-gdp', 'term-real-vs-nominal'],
  },
  {
    topic: 'Trade',
    match: /\btrade\b|export|import|foreign direct|\bfdi\b|freight/i,
    terms: ['term-trade-balance', 'term-fdi'],
  },
  {
    topic: 'Jobs',
    match: /unemployment|employment|labour|labor market|\bjobs\b/i,
    terms: ['term-unemployment'],
  },
  {
    topic: 'Banking',
    match: /\bbank\b|banking|credit|liquidity|deposits/i,
    terms: ['term-interest-rates'],
  },
  {
    topic: 'Policy',
    match: /policy|regulat|government|council|committee/i,
    terms: ['term-interest-rates', 'term-data-revision'],
  },
];
export function enrichResearchItem(raw: FeedItem): FeedItem {
  const text = `${raw.title} ${raw.summary}`;
  const matched = rules.filter((rule) => rule.match.test(text));
  const source = sourceIdFor(raw);
  const geographic =
    source === 'pib' || source === 'world-bank'
      ? 'India'
      : raw.kind === 'news'
        ? 'Global economy'
        : null;
  return FeedItemSchema.parse({
    ...raw,
    topics: [
      ...new Set([
        ...raw.topics,
        ...(geographic ? [geographic] : []),
        ...(raw.kind === 'term' ? ['Basics', 'Investor basics'] : []),
        ...matched.map((rule) => rule.topic),
      ]),
    ].slice(0, 12),
    relatedIds: [
      ...new Set([...raw.relatedIds, ...matched.flatMap((rule) => rule.terms)]),
    ]
      .filter((id) => id !== raw.id)
      .slice(0, 12),
  });
}
export function buildResearchContext(
  item: FeedItem,
  collection: FeedItem[],
): ResearchContext {
  const visible = collection.filter(
    (v) => v.status === 'published' && v.id !== item.id,
  );
  const terms = visible
    .filter(
      (v) =>
        v.kind === 'term' &&
        (item.relatedIds.includes(v.id) ||
          v.topics.some(
            (topic) =>
              item.topics.includes(topic) &&
              ![
                'Basics',
                'Investor basics',
                'India',
                'Global economy',
                'Annual data',
              ].includes(topic),
          )),
    )
    .sort(
      (a, b) =>
        Number(item.relatedIds.includes(b.id)) -
          Number(item.relatedIds.includes(a.id)) || a.id.localeCompare(b.id),
    )
    .slice(0, 4);
  const meaningful = item.topics.filter(
    (topic) =>
      !['India', 'Global economy', 'Annual data', 'Basics'].includes(topic),
  );
  const related = visible
    .filter(
      (v) =>
        v.kind !== 'term' &&
        v.topics.some((topic) => meaningful.includes(topic)),
    )
    .sort(
      (a, b) =>
        Number(sourceIdFor(a) === sourceIdFor(item)) -
          Number(sourceIdFor(b) === sourceIdFor(item)) ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 4);
  const learning = learningContentItems
    .filter(
      (question) =>
        question.kind === 'quiz' &&
        learningReferences[question.id] &&
        item.topics.includes(learningReferences[question.id]!.topic),
    )
    .slice(0, 3)
    .map((question) => ({
      id: question.id,
      title: question.title,
      href: `#learning?question=${question.id}`,
    }));
  return ResearchContextSchema.parse({
    itemId: item.id,
    itemVersion: item.version,
    method: 'topic-context-v1',
    topics: item.topics,
    explanations: terms.slice(0, 2).map((term) => ({
      title: term.title,
      text: term.summary,
      href: `#read/${term.id}`,
    })),
    related,
    terms,
    learning,
    caveat:
      'Educational context and related reading use explicit topic/keyword matches. They do not establish causation, portfolio exposure or an investment recommendation. Source reports retain their own dates and scope.',
  });
}

import { LearningCatalogSchema, type LearningQuestion } from './learning.js';
export const learningContentRevision = 'glossary-dev001-v1' as const;
// Rubrics are authored against the repository glossary, not generated from live prices.
export const learningContentItems: LearningQuestion[] =
  LearningCatalogSchema.parse({
    items: [
      {
        id: 'isin-meaning',
        version: 1,
        kind: 'quiz',
        title: 'Know the identifier',
        prompt: 'What does an ISIN identify?',
        choices: [
          { id: 'security', text: 'A security or investment instrument' },
          { id: 'account', text: 'Your personal brokerage account' },
          { id: 'price', text: 'The current market price' },
        ],
        source: {
          title: 'Fingent360 product glossary · ISIN',
          revision: learningContentRevision,
          excerpt:
            'Security identifier used in matching; not a user account or an exchange-specific ticker.',
        },
      },
      {
        id: 'reconciliation',
        version: 1,
        kind: 'quiz',
        title: 'Check before saving',
        prompt: 'Your CSV was parsed successfully. What still needs checking?',
        choices: [
          {
            id: 'totals',
            text: 'Its quantities and totals against the source records',
          },
          {
            id: 'nothing',
            text: 'Nothing: parsing proves every number is correct',
          },
          { id: 'returns', text: 'Whether it guarantees a profit' },
        ],
        source: {
          title: 'Fingent360 product glossary · Reconciliation',
          revision: learningContentRevision,
          excerpt:
            'Comparing imported/calculated values against source totals under a stated rule; not assuming an upload is correct because parsing succeeded.',
        },
      },
      {
        id: 'learning-interest',
        version: 1,
        kind: 'poll',
        title: 'What would you like to understand?',
        prompt: 'Choose the topic you would like explained next.',
        choices: [
          { id: 'sources', text: 'Checking financial sources' },
          { id: 'holdings', text: 'Understanding my holdings' },
          { id: 'goals', text: 'Planning for a goal' },
        ],
        source: {
          title: 'Fingent360 learning preference poll',
          revision: learningContentRevision,
          excerpt:
            'Voluntary learning interests only. Responses are not a market forecast, recommendation or representative survey.',
        },
      },
    ],
  }).items;
export const learningRubrics: Record<
  string,
  { answer: string; explanation: string }
> = {
  'isin-meaning': {
    answer: 'security',
    explanation:
      'An ISIN identifies a security. A valid check digit alone does not verify your ownership, the issuer record or a market price.',
  },
  reconciliation: {
    answer: 'totals',
    explanation:
      'Parsing checks the format. Reconciliation separately checks quantities and totals against the source under a stated rule.',
  },
};

// Supplementary references do not rewrite existing question/attempt revisions.
// Summaries are authored paraphrases; these are educational links, not live data.
export const learningReferences: Record<
  string,
  { title: string; url: string; topic: string; note: string }
> = {
  'isin-meaning': {
    title: 'NSDL · FAQs on depository system',
    url: 'https://investor.nsdl.com/portal/en/kb/articles/faqs-on-depository-system',
    topic: 'Investor basics',
    note: 'NSDL describes an ISIN as the unique identifier allotted to a security.',
  },
  reconciliation: {
    title: 'Investor.gov · Investment products and risks',
    url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products',
    topic: 'Investor basics',
    note: 'Read about investment products and risks. The reconciliation rule above is our explicit record-checking workflow, not an assertion that parsing verifies ownership.',
  },
  'learning-interest': {
    title: 'Investor.gov · Introduction to investing',
    url: 'https://www.investor.gov/introduction-investing',
    topic: 'Investor basics',
    note: 'A starting point for general investment education; your preference is not a suitability assessment.',
  },
  'diversification-basics': {
    title: 'Investor.gov · Asset allocation and diversification',
    url: 'https://www.investor.gov/introduction-investing/getting-started/asset-allocation',
    topic: 'Investor basics',
    note: 'Diversification spreads investments to help manage risk; it cannot promise a profit.',
  },
  'inflation-basics': {
    title: 'ECB · What is inflation?',
    url: 'https://www.ecb.europa.eu/ecb-and-you/explainers/tell-me-more/html/what_is_inflation.en.html',
    topic: 'Inflation',
    note: 'Different inflation indices measure different baskets. This question is conceptual, not a current inflation reading.',
  },
};
learningContentItems.push(
  ...LearningCatalogSchema.parse({
    items: [
      {
        id: 'diversification-basics',
        version: 1,
        kind: 'quiz',
        title: 'Spread the risk',
        prompt: 'What is diversification intended to do?',
        choices: [
          {
            id: 'spread',
            text: 'Spread investments to help manage concentration risk',
          },
          {
            id: 'guarantee',
            text: 'Guarantee that investments cannot lose value',
          },
          { id: 'predict', text: 'Predict the next winning stock' },
        ],
        source: {
          title: 'Authored basic glossary · Diversification',
          revision: learningContentRevision,
          excerpt:
            'Diversification spreads investments across different exposures. It does not eliminate investment risk or guarantee a return.',
        },
      },
      {
        id: 'inflation-basics',
        version: 1,
        kind: 'quiz',
        title: 'Prices and purchasing power',
        prompt:
          'If prices rise while your budget stays the same, what generally happens?',
        choices: [
          { id: 'less', text: 'The same budget buys less' },
          { id: 'more', text: 'The same budget automatically buys more' },
          {
            id: 'guaranteed',
            text: 'Every investment return rises by the same amount',
          },
        ],
        source: {
          title: 'Authored basic glossary · Inflation',
          revision: learningContentRevision,
          excerpt:
            'A rise in prices reduces what a fixed nominal budget can buy. A price index measures a defined basket, not every household’s exact experience.',
        },
      },
    ],
  }).items,
);
learningRubrics['diversification-basics'] = {
  answer: 'spread',
  explanation:
    'Spreading investments can reduce concentration risk. Diversification does not guarantee a profit or prevent every loss.',
};
learningRubrics['inflation-basics'] = {
  answer: 'less',
  explanation:
    'When prices rise, a fixed amount of money buys less. Your actual spending basket can differ from the basket measured by a published index.',
};

learningContentItems.push(
  ...LearningCatalogSchema.parse({
    items: [
      {
        id: 'data-revisions',
        version: 1,
        kind: 'quiz',
        title: 'When a published number changes',
        prompt: 'Why can a statistical agency revise an earlier GDP estimate?',
        choices: [
          {
            id: 'evidence',
            text: 'More complete source data or updated methods become available',
          },
          {
            id: 'erase',
            text: 'To erase the need to keep the previous release',
          },
          { id: 'predict', text: 'To guarantee the next quarter’s growth' },
        ],
        source: {
          title: 'Authored basic glossary · Data revisions',
          revision: learningContentRevision,
          excerpt:
            'Early estimates can be revised as source information improves. Compare the same period, unit and release edition; retain earlier editions for reconstruction.',
        },
      },
      {
        id: 'basis-points',
        version: 1,
        kind: 'quiz',
        title: 'Read a rate change',
        prompt:
          'A change of 25 basis points equals how many percentage points?',
        choices: [
          { id: 'quarter', text: '0.25 percentage points' },
          { id: 'twentyfive', text: '25 percentage points' },
          { id: 'relative', text: 'Always a 25% relative change' },
        ],
        source: {
          title: 'Authored basic glossary · Basis points',
          revision: learningContentRevision,
          excerpt:
            'One basis point is one hundredth of a percentage point. Percentage-point changes and relative percentage changes are different measures.',
        },
      },
      {
        id: 'trade-balance',
        version: 1,
        kind: 'quiz',
        title: 'Understand a trade balance',
        prompt:
          'For a defined period and scope, what does a trade deficit mean?',
        choices: [
          {
            id: 'imports',
            text: 'The value of imports exceeds the value of exports',
          },
          {
            id: 'forecast',
            text: 'Every listed company will lose money next quarter',
          },
          { id: 'exports', text: 'Exports must be zero' },
        ],
        source: {
          title: 'Authored basic glossary · Trade balance',
          revision: learningContentRevision,
          excerpt:
            'A trade balance compares exports and imports for a stated period and coverage. The sign alone does not forecast any company’s earnings or investment returns.',
        },
      },
    ],
  }).items,
);
learningRubrics['data-revisions'] = {
  answer: 'evidence',
  explanation:
    'Statistical agencies can incorporate more complete data and improved methods. Keep the period, units and release date visible rather than silently replacing the historical record.',
};
learningRubrics['basis-points'] = {
  answer: 'quarter',
  explanation:
    '100 basis points equal one percentage point, so 25 basis points equal 0.25 percentage points. This is not automatically a 25% relative change.',
};
learningRubrics['trade-balance'] = {
  answer: 'imports',
  explanation:
    'A deficit means imports exceed exports for the stated scope and period. It is not a forecast of individual company results.',
};
learningReferences['data-revisions'] = {
  title: 'BEA · Why do old GDP numbers keep changing?',
  url: 'https://www.bea.gov/news/blog/2016-06-29/why-do-old-gdp-numbers-keep-changing',
  topic: 'Growth',
  note: 'BEA explains revisions as source information becomes more complete. This is a data-literacy principle, not a claim about today’s growth rate.',
};
learningReferences['basis-points'] = {
  title: 'Federal Reserve · Open market operations',
  url: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm',
  topic: 'Rates',
  note: 'The Federal Reserve defines a basis point as one hundredth of a percentage point. No rate forecast is implied.',
};
learningReferences['trade-balance'] = {
  title: 'BEA · International trade in goods and services',
  url: 'https://www.bea.gov/data/intl-trade-investment/international-trade-goods-and-services',
  topic: 'Trade',
  note: 'Check whether the source covers goods, services or both, and the reporting period. This quiz contains no current trade figures.',
};

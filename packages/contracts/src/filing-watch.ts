import { z } from 'zod';
import { EquityEditionSchema } from './equity-coverage.js';
export const FILING_WATCH_SOURCES = [
  {
    symbol: 'ASMS',
    isin: 'INE855F01042',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194120_15092026160502_iXBRL_WEB.html',
  },
  {
    symbol: 'TIGERLOGS',
    isin: 'INE906O01029',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194116_15092026160337_iXBRL_WEB.html',
  },
  {
    symbol: 'BLSE',
    isin: 'INE0NLT01010',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194087_15092026132013_iXBRL_WEB.html',
  },
  {
    symbol: 'COFFEEDAY',
    isin: 'INE335K01011',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194065_15092026115216_iXBRL_WEB.html',
  },
  {
    symbol: 'SBC',
    isin: 'INE04AK01028',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194024_14092026181920_iXBRL_WEB.html',
  },
  {
    symbol: 'CMICABLES',
    isin: 'INE981B01011',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_194012_14092026165207_iXBRL_WEB.html',
  },
  {
    symbol: 'SRD',
    isin: 'INE01NE01012',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193995_14092026141206_iXBRL_WEB.html',
  },
  {
    symbol: 'ALPINETEX',
    isin: 'INE1JCQ01037',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193993_14092026133151_iXBRL_WEB.html',
  },
  {
    symbol: 'GHCLTEXTIL',
    isin: 'INE0PA801013',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193991_14092026125609_iXBRL_WEB.html',
  },
  {
    symbol: 'MUKKA',
    isin: 'INE0CG401037',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193985_14092026114856_iXBRL_WEB.html',
  },
  {
    symbol: 'INDOTECH',
    isin: 'INE332H01014',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193973_13092026105913_iXBRL_WEB.html',
  },
  {
    symbol: 'ORIENTELEC',
    isin: 'INE142Z01019',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193958_12092026183610_iXBRL_WEB.html',
  },
  {
    symbol: 'SURAJEST',
    isin: 'INE843S01025',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193952_12092026154846_iXBRL_WEB.html',
  },
  {
    symbol: 'SATIA',
    isin: 'INE170E01023',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193948_12092026145416_iXBRL_WEB.html',
  },
  {
    symbol: 'RAMASTEEL',
    isin: 'INE230R01035',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193943_12092026123414_iXBRL_WEB.html',
  },
  {
    symbol: 'BIGBLOC',
    isin: 'INE412U01025',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193940_12092026121900_iXBRL_WEB.html',
  },
  {
    symbol: 'SILVERTUC',
    isin: 'INE625X01026',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193938_12092026120902_iXBRL_WEB.html',
  },
  {
    symbol: 'LASA',
    isin: 'INE670X01014',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193936_12092026114715_iXBRL_WEB.html',
  },
  {
    symbol: 'SONATSOFTW',
    isin: 'INE269A01021',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193877_11092026190712_iXBRL_WEB.html',
  },
  {
    symbol: 'GOKULAGRO',
    isin: 'INE314T01033',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193858_11092026182216_iXBRL_WEB.html',
  },
  {
    symbol: 'LALITHAA',
    isin: 'INE0K9O01026',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193857_11092026182014_iXBRL_WEB.html',
  },
  {
    symbol: 'HORIZONIND',
    isin: 'INE685T01010',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193815_11092026171124_iXBRL_WEB.html',
  },
  {
    symbol: 'SRPL',
    isin: 'INE008Z01020',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193788_11092026163045_iXBRL_WEB.html',
  },
  {
    symbol: 'SOLEX',
    isin: 'INE880Y01017',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193733_11092026121854_iXBRL_WEB.html',
  },
  {
    symbol: 'SHANKESH',
    isin: 'INE1WFC01025',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_193695_10092026193538_iXBRL_WEB.html',
  },
] as const;
export const FilingWatchGateSchema = z
  .strictObject({
    enabled: z.boolean(),
    sourceIds: z.array(z.string()).min(1).max(25),
    rightsEvidence: z.string().trim().max(3000),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.sourceIds).size !== v.sourceIds.length ||
      v.sourceIds.some(
        (id) => !FILING_WATCH_SOURCES.some((s) => s.symbol === id),
      ) ||
      (v.enabled && v.rightsEvidence.length < 30)
    )
      c.addIssue({
        code: 'custom',
        message:
          'Select registered originals and record applicable permission.',
      });
  });
export const FilingWatchAttemptSchema = z
  .strictObject({
    id: z.uuid(),
    sourceId: z.string(),
    sourceUrl: z.url(),
    status: z.enum(['draft', 'unchanged', 'quarantine', 'unavailable']),
    editionId: z.uuid().nullable(),
    bodyHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    message: z.string(),
    edition: EquityEditionSchema.nullable(),
    editionState: z.enum(['draft', 'published', 'withdrawn']).nullable(),
    createdAt: z.iso.datetime(),
  })
  .superRefine((v, c) => {
    const source = FILING_WATCH_SOURCES.find((s) => s.symbol === v.sourceId);
    if (
      !source ||
      source.sourceUrl !== v.sourceUrl ||
      (v.status === 'draft' || v.status === 'unchanged') !==
        Boolean(v.editionId && v.edition && v.editionState) ||
      (v.edition &&
        (v.edition.id !== v.editionId ||
          v.edition.sourceUrl !== v.sourceUrl ||
          v.edition.hash !== v.bodyHash ||
          v.edition.observations.some(
            (o) => o.isin !== source?.isin || o.kind !== 'fundamental',
          ))) ||
      (v.status === 'unavailable' && v.bodyHash !== null) ||
      (v.status === 'quarantine' && !v.bodyHash)
    )
      c.addIssue({
        code: 'custom',
        message:
          'Filing attempt differs from its registered original or retained edition.',
      });
  });
export const FilingWatchStatusSchema = z.strictObject({
  gate: FilingWatchGateSchema,
  version: z.number().int().positive(),
  attempts: z.array(FilingWatchAttemptSchema).max(20),
  next: z.uuid().nullable(),
});

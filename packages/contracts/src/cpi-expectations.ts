import { z } from 'zod';
import {
  CLEVELAND_CPI_HISTORY_URL,
  CpiHistorySelectionSchema,
  CpiHistoryEvidenceSchema,
  parseClevelandCpiHistory,
} from './cleveland-cpi-history.js';
export {
  CLEVELAND_CPI_HISTORY_URL,
  CpiHistorySelectionSchema,
} from './cleveland-cpi-history.js';
export const CLEVELAND_NOWCAST_URL =
  'https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting' as const;
export const CpiSourceUrlSchema = z
  .string()
  .refine(
    (value) =>
      value === CLEVELAND_NOWCAST_URL ||
      value === CLEVELAND_CPI_HISTORY_URL ||
      /^https:\/\/www\.bls\.gov\/news\.release\/archives\/cpi_\d{8}\.htm$/.test(
        value,
      ),
  );
const decimal = z.string().regex(/^-?(0|[1-9]\d?)(\.\d{1,18})?$/);
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
const clean = (v: string) =>
  v
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const CpiCaptureSchema = z
  .strictObject({
    policy: z.literal('cleveland-bls-monthly-cpi-v1'),
    kind: z.enum([
      'model-nowcast',
      'historical-model-nowcast',
      'observed-release',
    ]),
    history: CpiHistoryEvidenceSchema.optional(),
    url: CpiSourceUrlSchema,
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: z.iso.datetime(),
    sourcePublishedOn: z.iso.date().nullable(),
    publicationPrecision: z.enum(['unknown', 'day']),
    measure: z.literal('US-CPI-U-headline-monthly-SA-nonannualized-percent'),
    points: z
      .array(
        z.strictObject({
          period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
          value: decimal,
          sourceRow: z.array(z.string()).min(1).max(6),
          updateLabel: z.string().nullable(),
        }),
      )
      .min(1)
      .max(3),
  })
  .superRefine((v, c) => {
    const bad = (message: string) => c.addIssue({ code: 'custom', message });
    if (new Set(v.points.map((p) => p.period)).size !== v.points.length)
      bad('Duplicate CPI month.');
    if (v.kind !== 'historical-model-nowcast' && v.history)
      bad('Historical metadata is only valid for an original chart vintage.');
    if (v.kind === 'historical-model-nowcast') {
      const h = v.history,
        p = v.points[0];
      if (
        v.url !== CLEVELAND_CPI_HISTORY_URL ||
        !h ||
        v.points.length !== 1 ||
        v.sourcePublishedOn !== null ||
        v.publicationPrecision !== 'unknown' ||
        !p ||
        p.period !== h.period ||
        p.sourceRow.length !== 4 ||
        p.sourceRow[0] !==
          `${h.period.slice(0, 4)}-${Number(h.period.slice(5))}` ||
        p.sourceRow[1] !== h.asOf.slice(5).replace('-', '/') ||
        p.updateLabel !== p.sourceRow[1] ||
        p.sourceRow[2] !== p.value ||
        p.sourceRow[3] !== h.tooltext ||
        h.tooltext !== `CPI Inflation{br}${p.updateLabel}{br}${p.value}{br}` ||
        h.asOf > h.archiveGeneratedLabel.slice(0, 10) ||
        h.archiveGeneratedLabel.slice(0, 10) > v.retrievedAt.slice(0, 10)
      )
        bad(
          'Historical model value does not reconstruct from the dated archive selection.',
        );
    } else if (v.kind === 'model-nowcast') {
      if (
        v.url !== CLEVELAND_NOWCAST_URL ||
        v.sourcePublishedOn !== null ||
        v.publicationPrecision !== 'unknown'
      )
        bad('Current nowcast page cannot prove a historical publication time.');
      for (const p of v.points) {
        const row = p.sourceRow;
        if (
          row.length !== 6 ||
          row[0] !==
            `${months[Number(p.period.slice(5)) - 1]} ${p.period.slice(0, 4)}` ||
          row[1] !== p.value ||
          row[5] !== p.updateLabel ||
          !/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(p.updateLabel ?? '')
        )
          bad('Nowcast value does not reconstruct from exact source cells.');
      }
    } else if (
      v.url === CLEVELAND_NOWCAST_URL ||
      !v.sourcePublishedOn ||
      v.publicationPrecision !== 'day' ||
      v.sourcePublishedOn > v.retrievedAt.slice(0, 10) ||
      !v.url.endsWith(
        `cpi_${v.sourcePublishedOn.slice(5, 7)}${v.sourcePublishedOn.slice(8)}${v.sourcePublishedOn.slice(0, 4)}.htm`,
      ) ||
      v.points.length !== 1
    )
      bad('Original BLS date/URL does not agree.');
    if (v.kind === 'observed-release')
      for (const p of v.points) {
        const claim =
          /^The Consumer Price Index for All Urban Consumers \(CPI-U\) (increased|decreased) (\d+(?:\.\d+)?) percent on a seasonally adjusted basis in ([A-Za-z]+)$/.exec(
            p.sourceRow[0] ?? '',
          );
        if (
          p.sourceRow.length !== 3 ||
          p.sourceRow[1] !==
            `CONSUMER PRICE INDEX - ${months[Number(p.period.slice(5)) - 1]?.toUpperCase()} ${p.period.slice(0, 4)}` ||
          !p.sourceRow[2]?.endsWith(
            `${months[Number(v.sourcePublishedOn?.slice(5, 7)) - 1]} ${Number(v.sourcePublishedOn?.slice(8))}, ${v.sourcePublishedOn?.slice(0, 4)}`,
          ) ||
          p.updateLabel !== null ||
          !claim ||
          `${claim[1] === 'decreased' ? '-' : ''}${claim[2]}` !== p.value ||
          months[Number(p.period.slice(5)) - 1] !== claim[3] ||
          !v.sourcePublishedOn ||
          p.period >= v.sourcePublishedOn.slice(0, 7)
        )
          bad(
            'Actual value does not reconstruct from its original monthly CPI claim.',
          );
      }
  });
export const CpiExpectationInputSchema = z.strictObject({
  requestId: z.uuid(),
  url: CpiSourceUrlSchema,
  body: z.string().min(1).max(10000000),
  historySelection: CpiHistorySelectionSchema.optional(),
  rightsBasis: z.string().trim().min(12).max(1000),
  rightsConfirmed: z.literal(true),
});
export const CpiExpectationEditionSchema = z.strictObject({
  id: z.uuid(),
  expectation: CpiCaptureSchema,
  rightsBasis: z.string(),
  capturedBy: z.string(),
});
export const CpiExpectationReviewSchema = z.strictObject({
  requestId: z.uuid(),
  editionId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(5).max(1000),
});
export const CpiExpectationQueueSchema = z.strictObject({
  editions: z
    .array(
      z.strictObject({
        edition: CpiExpectationEditionSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
      }),
    )
    .max(100),
  nextCursor: z.string().max(100).nullable().default(null),
});
export const CpiExpectationPublicSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  editions: z
    .array(
      CpiExpectationEditionSchema.omit({
        rightsBasis: true,
        capturedBy: true,
      }).extend({ reviewedAt: z.iso.datetime() }),
    )
    .max(100),
});
export function parseCpiCapture(raw: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
  historySelection?: unknown;
}) {
  CpiSourceUrlSchema.parse(raw.url);
  if (
    raw.body.length >
    (raw.url === CLEVELAND_CPI_HISTORY_URL ? 10000000 : 2000000)
  )
    throw Error('Source exceeds its supported size limit.');
  if (raw.url !== CLEVELAND_CPI_HISTORY_URL && raw.historySelection)
    throw Error('Historical selection requires the original monthly archive.');
  const base = {
    policy: 'cleveland-bls-monthly-cpi-v1',
    url: raw.url,
    hash: raw.hash,
    retrievedAt: raw.retrievedAt,
    measure: 'US-CPI-U-headline-monthly-SA-nonannualized-percent',
  };
  if (raw.url === CLEVELAND_CPI_HISTORY_URL) {
    const p = parseClevelandCpiHistory(raw.body, raw.historySelection);
    return CpiCaptureSchema.parse({
      ...base,
      kind: 'historical-model-nowcast',
      history: p.history,
      sourcePublishedOn: null,
      publicationPrecision: 'unknown',
      points: [
        {
          period: p.history.period,
          value: p.value,
          sourceRow: p.sourceRow,
          updateLabel: p.updateLabel,
        },
      ],
    });
  }
  if (raw.url === CLEVELAND_NOWCAST_URL) {
    if (
      [...raw.body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].filter(
        (m) => clean(m[1]!) === 'Inflation Nowcasting',
      ).length !== 1
    )
      throw Error('Exact nowcast page heading required.');
    const tables = [...raw.body.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
      .map((m) => m[1]!)
      .filter(
        (table) =>
          clean(
            /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1] ?? '',
          ) === 'Inflation, month-over-month percent change',
      );
    if (tables.length !== 1)
      throw Error('One exact monthly nowcast table required.');
    const table = tables[0]!,
      head = /<thead\b[^>]*>([\s\S]*?)<\/thead>/i.exec(table)?.[1],
      body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table)?.[1];
    if (
      clean(head ?? '') !== 'Month CPI Core CPI PCE Core PCE Updated' ||
      !body
    )
      throw Error('Unsupported nowcast header.');
    const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
      [...m[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
        clean(cell[1]!),
      ),
    );
    if (!rows.length || rows.length > 3 || rows.some((r) => r.length !== 6))
      throw Error('Unsupported nowcast row width/count.');
    const points = rows
      .filter((r) => r[1] !== '')
      .map((r) => {
        const m = /^([A-Za-z]+) (20\d{2})$/.exec(r[0]!);
        if (!m || !months.includes(m[1]!))
          throw Error('Explicit forecast month required.');
        return {
          period: `${m[2]}-${String(months.indexOf(m[1]!) + 1).padStart(2, '0')}`,
          value: r[1],
          sourceRow: r,
          updateLabel: r[5],
        };
      });
    return CpiCaptureSchema.parse({
      ...base,
      kind: 'model-nowcast',
      sourcePublishedOn: null,
      publicationPrecision: 'unknown',
      points,
    });
  }
  const text = clean(raw.body),
    head = /CONSUMER PRICE INDEX - ([A-Z]+) (20\d{2})/.exec(text),
    release =
      /8:30 a\.m\. \(ET\) (Monday|Tuesday|Wednesday|Thursday|Friday), ([A-Za-z]+) (\d{1,2}), (20\d{2})/.exec(
        text,
      ),
    claim =
      /The Consumer Price Index for All Urban Consumers \(CPI-U\) (increased|decreased) (\d+(?:\.\d+)?) percent on a seasonally adjusted basis in ([A-Za-z]+)/.exec(
        text,
      );
  if (
    [...text.matchAll(/CONSUMER PRICE INDEX - [A-Z]+ 20\d{2}/g)].length !== 1 ||
    [
      ...text.matchAll(
        /The Consumer Price Index for All Urban Consumers \(CPI-U\) (?:increased|decreased) \d+(?:\.\d+)? percent on a seasonally adjusted basis in [A-Za-z]+/g,
      ),
    ].length !== 1
  )
    throw Error('Ambiguous BLS headline claims.');
  if (
    !head ||
    !release ||
    !claim ||
    !months.includes(release[2]!) ||
    head[1] !== claim[3]!.toUpperCase() ||
    !months.includes(claim[3]!)
  )
    throw Error('Exact BLS headline monthly claim and release date required.');
  const sourcePublishedOn = z.iso
      .date()
      .parse(
        `${release[4]}-${String(months.indexOf(release[2]!) + 1).padStart(2, '0')}-${release[3]!.padStart(2, '0')}`,
      ),
    period = `${head[2]}-${String(months.indexOf(claim[3]!) + 1).padStart(2, '0')}`,
    value = `${claim[1] === 'decreased' ? '-' : ''}${claim[2]}`;
  if (period >= sourcePublishedOn.slice(0, 7))
    throw Error('BLS actual must follow its reference month.');
  return CpiCaptureSchema.parse({
    ...base,
    kind: 'observed-release',
    sourcePublishedOn,
    publicationPrecision: 'day',
    points: [
      {
        period,
        value,
        sourceRow: [claim[0], head[0], release[0]],
        updateLabel: null,
      },
    ],
  });
}
export function compareCpiSnapshots(
  nowcast: ReturnType<
    typeof CpiExpectationPublicSchema.parse
  >['editions'][number],
  actual: ReturnType<
    typeof CpiExpectationPublicSchema.parse
  >['editions'][number],
  period: string,
) {
  const n = CpiCaptureSchema.parse(nowcast.expectation),
    a = CpiCaptureSchema.parse(actual.expectation),
    np = n.points.find((p) => p.period === period),
    ap = a.points.find((p) => p.period === period);
  if (
    !['model-nowcast', 'historical-model-nowcast'].includes(n.kind) ||
    a.kind !== 'observed-release' ||
    !np ||
    !ap ||
    !a.sourcePublishedOn
  )
    return {
      difference: null,
      prospective: false,
      reason: 'Matching reviewed headline monthly CPI evidence is unavailable.',
    };
  const places = Math.max(
      2,
      np.value.split('.')[1]?.length ?? 0,
      ap.value.split('.')[1]?.length ?? 0,
    ),
    scale = 10n ** BigInt(places);
  const scaled = (v: string) => {
      const [w, f = ''] = v.replace('-', '').split('.');
      const x = BigInt(w!) * scale + BigInt(f.padEnd(places, '0'));
      return v.startsWith('-') ? -x : x;
    },
    delta = scaled(ap.value) - scaled(np.value),
    abs = delta < 0n ? -delta : delta;
  const prospective =
    n.kind === 'model-nowcast' &&
    nowcast.reviewedAt >= n.retrievedAt &&
    nowcast.reviewedAt.slice(0, 10) < a.sourcePublishedOn &&
    n.retrievedAt.slice(0, 10) < a.sourcePublishedOn;
  const priorHistoricalVintage = Boolean(
    n.history && n.history.asOf < a.sourcePublishedOn,
  );
  return {
    difference: `${delta < 0n ? '-' : ''}${abs / scale}.${String(abs % scale).padStart(places, '0')}`,
    prospective,
    priorHistoricalVintage,
    reason: n.history
      ? priorHistoricalVintage
        ? 'Historical Cleveland Fed model vintage predates the actual release day. Retrospectively acquired; exact source publication time and prior app availability are not proven. This is model error, not market-consensus surprise.'
        : 'The historical vintage does not predate the actual release day; no prior-expectation claim is supported.'
      : prospective
        ? 'Captured and independently admitted before the actual release day.'
        : 'Retrospective comparison only: earlier model publication and app availability are not proven; same-day ordering is unknown.',
  };
}

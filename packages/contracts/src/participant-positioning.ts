import { z } from 'zod';
import { equityCsv } from './equity-coverage.js';
const Count = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
export const OI_FIELDS = [
  'Future Index Long',
  'Future Index Short',
  'Future Stock Long',
  'Future Stock Short',
  'Option Index Call Long',
  'Option Index Put Long',
  'Option Index Call Short',
  'Option Index Put Short',
  'Option Stock Call Long',
  'Option Stock Put Long',
  'Option Stock Call Short',
  'Option Stock Put Short',
  'Total Long Contracts',
  'Total Short Contracts',
] as const;
export const PositioningInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    filename: z.string().regex(/^fao_participant_oi_\d{8}\.csv$/),
    sourceUrl: z.url(),
    csv: z.string().min(1).max(2_000_000),
    rightsEvidence: z.string().trim().min(20).max(2000),
    rightsConfirmed: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (
      ![
        'https://archives.nseindia.com/content/nsccl/',
        'https://nsearchives.nseindia.com/content/nsccl/',
      ].some((prefix) => value.sourceUrl === prefix + value.filename)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use the original dated NSE participant OI file URL.',
      });
  });
const Row = z.strictObject({
  participant: z.enum(['Client', 'DII', 'FII', 'Pro', 'TOTAL']),
  counts: z.array(Count).length(14),
});
export const PositioningEditionSchema = z
  .strictObject({
    id: z.uuid(),
    effectiveOn: z.iso.date(),
    retrievedAt: z.iso.datetime(),
    sourceUrl: z.url(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    filename: z.string().regex(/^fao_participant_oi_\d{8}\.csv$/),
    policy: z.literal('nse-participant-oi-contracts-v1'),
    unit: z.literal('contracts'),
    rows: z.array(Row).length(5),
    reviewedAt: z.iso.datetime().nullable(),
    interpretation: z.literal(
      'Open positions by participant and instrument; not cash flows, directional conviction or a portfolio recommendation.',
    ),
  })
  .superRefine((value, ctx) => {
    try {
      validateRows(value.rows);
      const expected =
        'fao_participant_oi_' +
        value.effectiveOn.slice(8, 10) +
        value.effectiveOn.slice(5, 7) +
        value.effectiveOn.slice(0, 4) +
        '.csv';
      if (
        value.filename !== expected ||
        value.effectiveOn > value.retrievedAt.slice(0, 10) ||
        ![
          'https://archives.nseindia.com/content/nsccl/',
          'https://nsearchives.nseindia.com/content/nsccl/',
        ].some((prefix) => value.sourceUrl === prefix + expected)
      )
        throw Error('Positioning source date, filename and URL must agree.');
    } catch (cause) {
      ctx.addIssue({
        code: 'custom',
        message:
          cause instanceof Error
            ? cause.message
            : 'Unreconciled positioning rows.',
      });
    }
  });
export const PositioningReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
  rightsVerified: z.boolean(),
});
export const PositioningCaptureSchema = z.strictObject({
  id: z.uuid(),
  state: z.enum(['retained', 'quarantined']),
  reason: z.string().nullable(),
});
export const PositioningQueueSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      source_hash: z.string(),
      error: z.string().nullable(),
      receipt: PositioningEditionSchema.nullable(),
      state: z.enum(['draft', 'publish', 'withdraw', 'quarantined']),
    }),
  )
  .max(100);
export const PositioningPublicSchema = z.strictObject({
  editions: z
    .array(PositioningEditionSchema)
    .max(100)
    .refine(
      (rows) => rows.every((row) => row.reviewedAt !== null),
      'Only independently reviewed positioning is public.',
    ),
  capturedAt: z.iso.datetime(),
});
export function parseParticipantPositioning(
  raw: unknown,
  sourceHash: string,
  retrievedAt: string,
) {
  const input = PositioningInputSchema.parse(raw),
    lines = input.csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const title =
    /^""Participant wise Open Interest \(no\. of contracts\) in Equity Derivatives as on ([A-Z][a-z]{2}) (\d{2}), (\d{4})"",{14}$/.exec(
      lines.shift() ?? '',
    );
  if (!title) throw Error('Unsupported original NSE OI title/date row.');
  const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    month = months.indexOf(title[1]!) + 1;
  const date = title[3] + '-' + String(month).padStart(2, '0') + '-' + title[2];
  if (
    !month ||
    !z.iso.date().safeParse(date).success ||
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date ||
    date > retrievedAt.slice(0, 10) ||
    input.filename !==
      'fao_participant_oi_' +
        title[2] +
        String(month).padStart(2, '0') +
        title[3] +
        '.csv'
  )
    throw Error('Source title, filename and real calendar date must agree.');
  const csv = equityCsv(lines.join('\n'));
  if (
    JSON.stringify(csv.header) !==
      JSON.stringify(['Client Type', ...OI_FIELDS]) ||
    csv.rows.length !== 5
  )
    throw Error(
      'Expected all fifteen official OI fields and all five participant rows.',
    );
  const rows = csv.rows.map((row) => {
    if (row.length !== 15) throw Error('Incomplete OI row.');
    return Row.parse({ participant: row[0], counts: row.slice(1) });
  });
  validateRows(rows);
  return PositioningEditionSchema.parse({
    id: input.requestId,
    effectiveOn: date,
    retrievedAt,
    sourceUrl: input.sourceUrl,
    sourceHash,
    filename: input.filename,
    policy: 'nse-participant-oi-contracts-v1',
    unit: 'contracts',
    rows,
    reviewedAt: null,
    interpretation:
      'Open positions by participant and instrument; not cash flows, directional conviction or a portfolio recommendation.',
  });
}

function validateRows(rows: ReturnType<typeof Row.parse>[]) {
  if (new Set(rows.map((row) => row.participant)).size !== 5)
    throw Error('Duplicate or missing participant row.');
  const longs = [0, 2, 4, 5, 8, 9],
    shorts = [1, 3, 6, 7, 10, 11];
  for (const row of rows) {
    for (const [indices, total] of [
      [longs, 12],
      [shorts, 13],
    ] as const) {
      if (
        indices.reduce((sum, i) => sum + BigInt(row.counts[i]!), 0n) !==
        BigInt(row.counts[total]!)
      )
        throw Error(
          'Participant total does not reconcile to instrument contract counts.',
        );
    }
  }
  const total = rows.find((row) => row.participant === 'TOTAL')!;
  for (let i = 0; i < 14; i++)
    if (
      rows
        .filter((row) => row.participant !== 'TOTAL')
        .reduce((sum, row) => sum + BigInt(row.counts[i]!), 0n) !==
      BigInt(total.counts[i]!)
    )
      throw Error('Participant column totals do not reconcile.');
  for (const [long, short] of [
    [0, 1],
    [2, 3],
    [4, 6],
    [5, 7],
    [8, 10],
    [9, 11],
    [12, 13],
  ])
    if (total.counts[long!] !== total.counts[short!])
      throw Error(
        'Exchange-wide matched long and short positions do not reconcile.',
      );
}

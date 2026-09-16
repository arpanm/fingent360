import { z } from 'zod';
export const EIA_SPOT_URL =
  'https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm' as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/),
  day = z.iso.date(),
  value = z.string().regex(/^-?(?:0|[1-9]\d{0,5})\.\d{2}$/);
export const EiaSpotInputSchema = z.strictObject({
  requestId: z.uuid(),
  body: z.string().min(1).max(1000000),
});
export const EiaSpotGateSchema = z
  .strictObject({
    enabled: z.boolean(),
    rightsEvidence: z.string().trim().max(3000),
  })
  .refine(
    (v) => !v.enabled || v.rightsEvidence.length >= 30,
    'Record applicable contributor permission first.',
  );
export const EiaSpotReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    policy: z.literal('eia-daily-crude-spot-v1'),
    url: z.literal(EIA_SPOT_URL),
    bodyHash: hash,
    retrievedAt: z.iso.datetime(),
    releasedOn: day,
    nextReleaseOn: day,
    unit: z.literal('USD-per-barrel'),
    frequency: z.literal('daily-closing-spot'),
    attribution: z.literal(
      'U.S. Energy Information Administration; Refinitiv, an LSEG business',
    ),
    points: z
      .array(
        z.strictObject({
          series: z.enum(['WTI', 'BRENT']),
          observedOn: day,
          value: value.nullable(),
          sourceCell: z.string().max(20),
        }),
      )
      .length(12),
  })
  .superRefine((v, c) => {
    if (
      v.releasedOn > v.retrievedAt.slice(0, 10) ||
      v.nextReleaseOn < v.releasedOn ||
      new Set(v.points.map((p) => p.series + p.observedOn)).size !== 12
    )
      c.addIssue({
        code: 'custom',
        message: 'Release dates or source row identities are inconsistent.',
      });
    for (const p of v.points) {
      if (
        p.observedOn > v.releasedOn ||
        (p.value === null
          ? !['', '-', '--', 'NA', 'W'].includes(p.sourceCell)
          : p.value !== p.sourceCell)
      )
        c.addIssue({
          code: 'custom',
          message: 'Daily cell does not reconstruct.',
        });
    }
  });
export const EiaSpotReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(3000),
  confirmed: z.boolean(),
});
export const EiaSpotQueueSchema = z.strictObject({
  gate: EiaSpotGateSchema,
  items: z
    .array(
      z.strictObject({
        receipt: EiaSpotReceiptSchema,
        state: z.enum(['draft', 'publish', 'withdraw']),
      }),
    )
    .max(20),
  next: z.uuid().nullable(),
});
export const EiaSpotPublicSchema = z
  .strictObject({
    receipt: EiaSpotReceiptSchema,
    reviewedAt: z.iso.datetime(),
    editions: z.array(z.uuid()).min(1).max(100),
  })
  .superRefine((v, c) => {
    if (
      !v.editions.includes(v.receipt.id) ||
      new Set(v.editions).size !== v.editions.length ||
      v.reviewedAt < v.receipt.retrievedAt
    )
      c.addIssue({
        code: 'custom',
        message: 'Published edition selection and review date must agree.',
      });
  });
const text = (v: string) =>
  v
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function fullDate(v: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/.exec(v);
  if (!m) throw Error('Explicit release date required.');
  return day.parse(
    `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`,
  );
}
export function parseEiaSpot(
  body: string,
  id: string,
  bodyHash: string,
  retrievedAt: string,
) {
  if (
    body.length > 1000000 ||
    !body.includes(
      '(Crude Oil in Dollars per Barrel, Products in Dollars per Gallon)',
    ) ||
    !/<option\b[^>]*value="pet_pri_spt_s1_d\.htm"[^>]*SELECTED[^>]*>\s*Daily/i.test(
      body,
    )
  )
    throw Error('Original daily crude-spot layout required.');
  const released = [
      ...body.matchAll(
        /class="Update"[^>]*>\s*Release Date:\s*(\d{1,2}\/\d{1,2}\/20\d{2})/g,
      ),
    ],
    next = [
      ...body.matchAll(/Next Release Date:\s*(\d{1,2}\/\d{1,2}\/20\d{2})/g),
    ];
  if (released.length !== 1 || next.length !== 1)
    throw Error('One source release date required.');
  const releasedOn = fullDate(released[0]![1]!),
    nextReleaseOn = fullDate(next[0]![1]!);
  const labels = [
    ...body.matchAll(/<th\b[^>]*class="Series5"[^>]*>([^<]+)<\/th>/g),
  ].map((m) => m[1]!.trim());
  if (labels.length !== 6) throw Error('Expected six original daily headers.');
  const dates = labels.map((label) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(label);
    if (!m) throw Error('Unsupported daily header.');
    const year = Number(releasedOn.slice(0, 4)),
      years = [year - 1, year].filter((y) => String(y).slice(-2) === m[3]);
    if (years.length !== 1) throw Error('Ambiguous header year.');
    return day.parse(`${years[0]}-${m[1]}-${m[2]}`);
  });
  if (dates.some((d, i) => d > releasedOn || (i > 0 && d <= dates[i - 1]!)))
    throw Error('Daily dates are unordered or future.');
  const points = (['WTI', 'BRENT'] as const).flatMap((series) => {
    const label =
        series === 'WTI' ? 'WTI - Cushing, Oklahoma' : 'Brent - Europe',
      code = series === 'WTI' ? 'RWTC' : 'RBRTE';
    const matches = [
      ...body.matchAll(
        new RegExp(
          '<td class="DataStub1">' +
            label +
            '<\\/td>([\\s\\S]*?)<td[^>]*class="DataHist">([\\s\\S]*?)<\\/td>',
          'g',
        ),
      ),
    ];
    if (matches.length !== 1 || !matches[0]![2]!.includes(`s=${code}&f=D`))
      throw Error('Exact crude series identity required.');
    const cells = [
      ...matches[0]![1]!.matchAll(
        /<td\b[^>]*class="(?:DataB|Current2)"[^>]*>([\s\S]*?)<\/td>/g,
      ),
    ].map((m) => text(m[1]!));
    if (cells.length !== 6) throw Error('Daily prices do not match headers.');
    return cells.map((cell, i) => ({
      series,
      observedOn: dates[i],
      value: ['', '-', '--', 'NA', 'W'].includes(cell)
        ? null
        : value.parse(cell),
      sourceCell: cell,
    }));
  });
  return EiaSpotReceiptSchema.parse({
    id,
    policy: 'eia-daily-crude-spot-v1',
    url: EIA_SPOT_URL,
    bodyHash,
    retrievedAt,
    releasedOn,
    nextReleaseOn,
    unit: 'USD-per-barrel',
    frequency: 'daily-closing-spot',
    attribution:
      'U.S. Energy Information Administration; Refinitiv, an LSEG business',
    points,
  });
}

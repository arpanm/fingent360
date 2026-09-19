import { z } from 'zod';
export const CLEVELAND_CPI_HISTORY_URL =
  'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en' as const;
export const CpiHistorySelectionSchema = z.strictObject({
  period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  asOf: z.iso.date(),
});
export const CpiHistoryEvidenceSchema = CpiHistorySelectionSchema.extend({
  archiveGeneratedLabel: z.string().regex(/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}$/),
  categoryIndex: z.number().int().nonnegative(),
  tooltext: z.string().max(500),
}).superRefine((value, context) => {
  const next = new Date(`${value.period}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (
    ![value.period, next.toISOString().slice(0, 7)].includes(
      value.asOf.slice(0, 7),
    ) ||
    !z.iso.date().safeParse(value.archiveGeneratedLabel.slice(0, 10)).success ||
    value.asOf > value.archiveGeneratedLabel.slice(0, 10)
  )
    context.addIssue({
      code: 'custom',
      message:
        'Historical vintage must match the target chart month window and generation date.',
    });
});
const chart = z.strictObject({
  _comment: z.string(),
  caption: z.literal('Inflation Nowcasting'),
  subcaption: z.string(),
  yaxisname: z.literal('Month-over-month percent change'),
  legendnumcolumns: z.string(),
  labelpadding: z.string(),
  showvalues: z.string(),
  showexportdatamenuitem: z.string(),
  showtooltip: z.string(),
  basefont: z.string(),
  bgalpha: z.string(),
  showborder: z.string(),
});
const category = z.union([
  z.strictObject({ label: z.string() }),
  z.strictObject({
    label: z.string(),
    labelposition: z.string(),
    lineposition: z.string(),
    color: z.string(),
    vline: z.literal('true'),
  }),
]);
const series = z.strictObject({
  seriesname: z.string(),
  color: z.string(),
  data: z
    .array(
      z.strictObject({
        value: z.string(),
        tooltext: z.string(),
        // Original actual-value series include chart marker styling. These
        // fields never determine the selected model value or vintage.
        anchorradius: z
          .string()
          .regex(/^\d{1,2}$/)
          .optional(),
        anchorbgcolor: z
          .string()
          .regex(/^[a-fA-F0-9]{6}$/)
          .optional(),
        anchorbordercolor: z
          .string()
          .regex(/^[a-fA-F0-9]{6}$/)
          .optional(),
        anchorborderthickness: z
          .string()
          .regex(/^\d{1,2}$/)
          .optional(),
      }),
    )
    .max(100),
});
const entry = z.strictObject({
  chart,
  categories: z
    .array(z.strictObject({ category: z.array(category).max(110) }))
    .length(1),
  dataset: z.array(series).min(4).max(8),
});
export function parseClevelandCpiHistory(body: string, selection: unknown) {
  const chosen = CpiHistorySelectionSchema.parse(selection);
  const all = z.array(entry).min(1).max(1000).parse(JSON.parse(body));
  const matches = all.filter(
    (v) =>
      v.chart.subcaption ===
      `${chosen.period.slice(0, 4)}-${Number(chosen.period.slice(5))}`,
  );
  if (matches.length !== 1)
    throw Error(
      'One original chart for the selected target month is required.',
    );
  const selected = matches[0]!,
    labels = selected.categories[0]!.category.filter((v) => !('vline' in v));
  const next = new Date(`${chosen.period}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (
    ![chosen.period, next.toISOString().slice(0, 7)].includes(
      chosen.asOf.slice(0, 7),
    )
  )
    throw Error('Vintage must belong to the target or following month.');
  const indices = labels.flatMap((v, i) =>
    v.label === chosen.asOf.slice(5).replace('-', '/') ? [i] : [],
  );
  const cpi = selected.dataset.filter((v) => v.seriesname === 'CPI Inflation');
  if (
    indices.length !== 1 ||
    cpi.length !== 1 ||
    cpi[0]!.data.length !== labels.length
  )
    throw Error('Historical CPI dates and values do not join unambiguously.');
  const index = indices[0]!,
    point = cpi[0]!.data[index]!,
    label = labels[index]!.label;
  if (
    !/^-?(0|[1-9]\d?)(\.\d{1,18})?$/.test(point.value) ||
    point.tooltext !== `CPI Inflation{br}${label}{br}${point.value}{br}`
  )
    throw Error(
      'Selected day has no original model value; released actuals are not forecasts.',
    );
  const history = CpiHistoryEvidenceSchema.parse({
    ...chosen,
    archiveGeneratedLabel: selected.chart._comment,
    categoryIndex: index,
    tooltext: point.tooltext,
  });
  if (history.asOf > history.archiveGeneratedLabel.slice(0, 10))
    throw Error('Vintage follows archive generation day.');
  return {
    history,
    value: point.value,
    sourceRow: [selected.chart.subcaption, label, point.value, point.tooltext],
    updateLabel: label,
  };
}

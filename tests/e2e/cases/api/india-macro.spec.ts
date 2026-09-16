import {
  test,
  expect,
  indiaMacroInput,
  indiaActors,
  indiaReview,
  retentionHeaders,
} from '../../helpers/india-macro';
import {
  IndiaMacroDashboardSchema,
  parseIndiaCpiCapture,
} from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
test.use({ namedOperators: true });
test('E2E-API-1320 CPI original release retains precise provisional/final vintages and enforces publication cutoff review and withdrawal @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indiaMacroInput();
    const result = await request.post('/api/v1/ops/india-macro/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(result.status(), await result.text()).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/india-macro/import', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    const review = indiaReview(input.requestId);
    expect(
      (
        await request.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const current = IndiaMacroDashboardSchema.parse(
      await (await request.get('/api/v1/india-macro')).json(),
    );
    expect(current.cpi.selected[0]).toMatchObject({
      period: '2026-06',
      index: '101.03',
      inflation: '1.03',
      status: 'provisional',
      publishedAt: '2026-07-13T10:30:00.000Z',
    });
    expect(current.cpi.selected[1]?.status).toBe('final');
    expect(current.cpi.editions[0]?.reconciliation).toBe(
      'matches-current-capture',
    );
    const before = IndiaMacroDashboardSchema.parse(
      await (
        await request.get('/api/v1/india-macro?asOf=2026-07-13T10:29:59.000Z')
      ).json(),
    );
    expect(before.cpi.selected).toEqual([]);
    const evidence = await (
      await request.get(`/api/v1/ops/india-macro/${input.requestId}/evidence`)
    ).json();
    expect(evidence.releaseHtml).toBe(input.releaseHtml);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: indiaReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      IndiaMacroDashboardSchema.parse(
        await (await request.get('/api/v1/india-macro')).json(),
      ).cpi.selected,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1321 reviewed official calendar preserves planned actual dates and source page independently @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/india-macro/calendar', {
          headers: retentionHeaders,
          data: {
            requestId: id,
            sourceUrl:
              'https://www.mospi.gov.in/uploads/documents/releaseCalender/synthetic.pdf',
            pdfBase64: Buffer.from(
              '%PDF-1.4\nSynthetic fixture only.\n%%EOF',
            ).toString('base64'),
            editionLabel: 'Synthetic calendar edition',
            rightsEvidence:
              'TEST-SIMULATION: synthetic fixture permission only.',
            rightsConfirmed: true,
            events: [
              {
                id: 'synthetic-cpi',
                series: 'in-cpi-2024-combined',
                title: 'Synthetic CPI release',
                plannedOn: '2026-04-12',
                actualOn: '2026-04-13',
                page: 1,
                sourceExcerpt: 'Synthetic planned12April and actual13April.',
              },
            ],
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: indiaReview(id),
        })
      ).status(),
    ).toBe(201);
    const data = IndiaMacroDashboardSchema.parse(
      await (await request.get('/api/v1/india-macro')).json(),
    );
    expect(data.calendar?.events[0]).toMatchObject({
      plannedOn: '2026-04-12',
      actualOn: '2026-04-13',
      page: 1,
    });
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1322 CPI parser refuses wrong base partial pages unknown fields and mixed geography @SRC-007 @TEST-SIMULATION', async () => {
  const value = JSON.parse(indiaMacroInput().apiBody);
  expect(parseIndiaCpiCapture(JSON.stringify(value))).toHaveLength(2);
  expect(() =>
    parseIndiaCpiCapture(
      JSON.stringify({
        ...value,
        meta_data: { ...value.meta_data, totalPages: 2 },
      }),
    ),
  ).toThrow();
  for (const field of [
    { base_year: '2012' },
    { state: 'Other state' },
    { unexpected: 'field' },
  ])
    expect(() =>
      parseIndiaCpiCapture(
        JSON.stringify({
          ...value,
          data: value.data.map((row: Record<string, unknown>) => ({
            ...row,
            ...field,
          })),
        }),
      ),
    ).toThrow();
});
test('E2E-API-1323 unsupported release is retained in quarantine with recoverable exact evidence and no public observation @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = {
      ...indiaMacroInput(),
      releaseHtml:
        '<h2>Unsupported layout</h2><p>This deliberately synthetic unsupported source must be retained without publishing any values.</p>',
    };
    const response = await request.post('/api/v1/ops/india-macro/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({
      id: input.requestId,
      status: 'quarantined',
    });
    const attempts = await (
      await request.get('/api/v1/ops/india-macro/attempts')
    ).json();
    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: input.requestId }),
      ]),
    );
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/india-macro/attempts/${input.requestId}/evidence`,
          )
        ).json()
      ).releaseHtml,
    ).toBe(input.releaseHtml);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: indiaReview(input.requestId),
        })
      ).status(),
    ).toBe(404);
    expect(
      IndiaMacroDashboardSchema.parse(
        await (await request.get('/api/v1/india-macro')).json(),
      ).cpi.selected,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});

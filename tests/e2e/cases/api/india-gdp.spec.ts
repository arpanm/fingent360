import {
  test,
  expect,
  indiaActors,
  indiaReview,
  retentionHeaders,
  indiaGdpInput,
} from '../../helpers/india-gdp';
import {
  IndiaMacroDashboardSchema,
  IndiaGdpPointSchema,
} from '../../../../packages/contracts/src/index';
import {
  parseIndiaGdpRelease,
  discoverIndiaGdp,
} from '../../../../apps/api/src/india-gdp-provider';
test.use({ namedOperators: true });
test('E2E-API-1770 original India GDP retains real base units publication calendar review cutoff and withdrawal @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indiaGdpInput();
    const captured = await request.post('/api/v1/ops/india-macro/gdp', {
      headers: retentionHeaders,
      data: input,
    });
    expect(captured.status(), await captured.text()).toBe(201);
    expect(await captured.json()).toMatchObject({ status: 'retained' });
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
    const result = IndiaMacroDashboardSchema.parse(
      await (await request.get('/api/v1/india-macro')).json(),
    );
    expect(result.gdp?.selected[0]).toMatchObject({
      publishedAt: '2026-08-31T10:30:00.000Z',
      point: {
        baseYear: '2022-23',
        quarter: 'Q1',
        value: '81.36',
        previousYearValue: '75.46',
        growthPercent: '7.8',
        unit: 'INR-lakh-crore',
      },
      nextRelease: {
        plannedOn: '2026-11-30',
        precision: 'day',
        actualOn: null,
      },
    });
    expect(
      IndiaMacroDashboardSchema.parse(
        await (
          await request.get('/api/v1/india-macro?asOf=2026-08-31T10:29:59.000Z')
        ).json(),
      ).gdp?.selected,
    ).toEqual([]);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/india-macro/${input.requestId}/evidence`,
          )
        ).json()
      ).releaseHtml,
    ).toBe(input.releaseHtml);
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
      ).gdp?.selected,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1771 India GDP rejects nominal swaps incompatible bases missing method mismatched growth and hidden index redirects @SRC-007 @TEST-SIMULATION', async () => {
  const input = indiaGdpInput(),
    release = parseIndiaGdpRelease(
      input.releaseHtml,
      input.releaseUrl,
      '2026-09-01T00:00:00.000Z',
    );
  expect(release.point.growthPercent).toBe('7.8');
  for (const body of [
    input.releaseHtml.replace('81.36', '91.36'),
    input.releaseHtml.replace(
      'Real GDP or GDP at Constant Prices',
      'Nominal GDP or GDP at Current Prices',
    ),
    input.releaseHtml.replace('Benchmark-Indicator', 'Unknown'),
    input.releaseHtml + '<p>base year 2011-12</p>',
    input.releaseHtml.replace('31 AUG', '32 AUG'),
    input.releaseHtml.replace('Q1 of FY 2025-26', 'Q2 of FY 2025-26'),
  ])
    expect(() =>
      parseIndiaGdpRelease(body, input.releaseUrl, '2026-09-01T00:00:00.000Z'),
    ).toThrow();
  expect(
    IndiaGdpPointSchema.safeParse({ ...release.point, growthPercent: 'bad' })
      .success,
  ).toBe(false);
  const listing =
    '<h1>All Releases</h1><h3>Ministry of Statistics &amp; Programme Implementation</h3><a href="/PressReleaseDetail.aspx?PRID=2304949">QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT</a><a href="https://evil.example/PressReleaseDetail.aspx?PRID=2304949">QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT</a>';
  expect(discoverIndiaGdp(listing)).toEqual([
    'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2304949&lang=1&reg=3',
  ]);
  expect(discoverIndiaGdp('<h1>All Releases</h1>')).toEqual([]);
});
test('E2E-API-1772 invalid GDP original stays retained quarantine without public observations @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indiaGdpInput();
    input.releaseHtml = input.releaseHtml.replace('81.36', '91.36');
    const capture = await request.post('/api/v1/ops/india-macro/gdp', {
      headers: retentionHeaders,
      data: input,
    });
    expect(capture.status()).toBe(201);
    expect(await capture.json()).toMatchObject({ status: 'quarantined' });
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
      ).gdp?.selected,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});

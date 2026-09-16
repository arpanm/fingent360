import { test, expect } from '../../helpers/feedback-fixture';
import {
  gdpOriginalInputs,
  gdpOriginalFixture,
} from '../../helpers/bea-gdp-original';
import { connectionHeaders } from '../../helpers/research-connection-fixture';
import {
  BeaGdpSeriesSchema,
  discoverBeaGdpOriginals,
  parseBeaGdpOriginal,
} from '../../../../packages/contracts/src/bea-gdp-original';
test('E2E-API-1480 original BEA numerical vintages retain actual periods publication times and reviewed source editions then withdraw @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const items = await gdpOriginalFixture(request, feedbackSandbox);
  const response = await request.get(
    '/api/v1/discovery/gdp-vintages?period=2025-Q2',
  );
  expect(response.status(), await response.text()).toBe(200);
  const series = BeaGdpSeriesSchema.parse(await response.json());
  expect(series.items.map((item) => item.original.value)).toEqual([
    '3.8',
    '3.3',
  ]);
  expect(series.items[1]?.original.publishedAt).toBe(
    '2025-08-28T12:30:00.000Z',
  );
  expect(series.items[1]?.original.retrievedAt).toBe(
    '2026-09-15T00:00:00.000Z',
  );
  const second = items[0]!;
  expect(
    (
      await request.get('/api/v1/discovery/items/' + second.id + '/evidence')
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put('/api/v1/ops/discovery/items/' + second.id, {
        headers: connectionHeaders,
        data: {
          expectedVersion: 2,
          status: 'withdrawn',
          correctionNote: 'TEST-SIMULATION: withdraw original release.',
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    BeaGdpSeriesSchema.parse(
      await (
        await request.get('/api/v1/discovery/gdp-vintages?period=2025-Q2')
      ).json(),
    ).items,
  ).toHaveLength(1);
  expect(
    await (await request.get('/api/v1/discovery/items/' + second.id)).json(),
  ).not.toHaveProperty('gdpOriginal');
});
test('E2E-API-1481 supported original BEA layouts reject wrong quarters timezone conflicts and untrusted index links @RESEARCH-AUTO-002 @TEST-SIMULATION', async () => {
  const inputs = await gdpOriginalInputs();
  for (const input of inputs)
    expect(parseBeaGdpOriginal(input).publishedAt).toBe(
      input.expectedPublishedAt,
    );
  const input = inputs[2]!;
  expect(parseBeaGdpOriginal(input)).toMatchObject({
    period: '2026-Q2',
    value: '1.5',
    estimate: 'second',
  });
  for (const body of [
    input.body.replace('EDT', 'EST'),
    input.body.replace('Wednesday', 'Thursday'),
    input.body.replace('in the second quarter', 'in the third quarter'),
    input.body.replace('8:30 a.m. EDT', 'time unavailable'),
  ])
    expect(() => parseBeaGdpOriginal({ ...input, body })).toThrow();
  const index = `<a href="${input.url}">GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026</a>`;
  expect(discoverBeaGdpOriginals(index)).toEqual([input.url]);
  expect(() =>
    discoverBeaGdpOriginals(
      index.replace('https://www.bea.gov', 'https://untrusted.example'),
    ),
  ).toThrow();
});

import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  parseCcilZero,
  parseCcilZeroPoints,
  CCIL_ZERO_RATES_URL,
} from '../../../../packages/contracts/src/index';
import {
  ccilZeroHtml,
  ccilZeroPointsHtml,
  publishedCcilZeroFixture,
} from '../../helpers/ccil-zero-curve';
import { governanceHeaders as headers } from '../../helpers/research-governance';
test('E2E-API-1970 original NSS numeric facts retain exact coefficients and reject changed grammar @SRC-017 @TEST-SIMULATION', async () => {
  const body = ccilZeroHtml(),
    data = parseCcilZero(body);
  expect(data.rows).toHaveLength(2);
  expect(data.rows[0]).toEqual({
    date: '2026-09-11',
    beta0: '8.2269',
    beta1: '-2.8677',
    beta2: '-15.8059',
    beta3: '17.9237',
    tau1: '8.7201',
    tau2: '8.7209',
  });
  expect(() => parseCcilZero(body.replace('tau2', 'tau3'))).toThrow();
  expect(() => parseCcilZero(body.replace('8.7201</td>', '0</td>'))).toThrow();
  expect(() =>
    parseCcilZero(body.replace('2026-09-10', '2026-09-11')),
  ).toThrow();
  expect(() =>
    parseCcilZero(body.replace('<td>8.2269</td>', '<td>8.2269</td><td>0</td>')),
  ).toThrow();
  expect(() =>
    parseCcilZero(body.replace('2026-09-11', '2026-02-30')),
  ).toThrow();
});
test('E2E-API-1971 actual default gate refuses NSS retention and distribution @SRC-017 @TEST-SIMULATION', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/ops/bond-zero-curve/import', {
        headers,
        data: { requestId: randomUUID(), body: ccilZeroHtml() },
      })
    ).status(),
  ).toBe(503);
  expect(await (await request.get('/api/v1/bond-zero-curve')).json()).toEqual({
    enabled: false,
    editions: [],
    nextCursor: null,
  });
});
test.describe('Explicit synthetic NSS deployment permission', () => {
  test.use({ namedOperators: true, ccilZeroSimulation: true });
  test('E2E-API-1972 original retention independent publication quarantine and withdrawal use actual storage @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilZeroFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      expect(
        (
          await (
            await request.get(`/api/v1/ops/bond-zero-curve/${f.id}/evidence`)
          ).json()
        ).body,
      ).toBe(ccilZeroHtml());
      expect(
        (await (await request.get('/api/v1/bond-zero-curve')).json()).editions,
      ).toHaveLength(1);
      expect(
        (
          await request.post(`/api/v1/ops/bond-zero-curve/${f.id}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'publish',
              reason: 'Same author must not independently review.',
            },
          })
        ).status(),
      ).toBe(403);
      const bad = randomUUID();
      expect(
        (
          await (
            await request.post('/api/v1/ops/bond-zero-curve/import', {
              headers,
              data: {
                requestId: bad,
                body: ccilZeroHtml().replace('tau2', 'unknown'),
              },
            })
          ).json()
        ).state,
      ).toBe('quarantined');
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-zero-curve/${bad}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'publish',
              reason: 'Unverified NSS layout cannot be released.',
            },
          })
        ).status(),
      ).toBe(409);
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-zero-curve/${f.id}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'withdraw',
              reason: 'Independent source withdrawal simulation.',
            },
          })
        ).status(),
      ).toBe(201);
      expect(
        (await (await request.get('/api/v1/bond-zero-curve/snapshot')).json())
          .editions,
      ).toEqual([]);
    } finally {
      await f.reviewer.dispose();
    }
  });
});

test('E2E-API-1973 independently read original zero points preserve source labels and reject missing and duplicate keys @SRC-017', async () => {
  const body = await ccilZeroPointsHtml(),
    data = parseCcilZeroPoints(body);
  expect(data.rows[0]?.points[0]).toEqual({
    maturityLabel: '0.0',
    reportedRate: '5.36',
  });
  expect(data.rows[0]?.points[20]).toEqual({
    maturityLabel: '10.0',
    reportedRate: '7.11',
  });
  expect(data.rows[0]?.points[100]).toEqual({
    maturityLabel: '50.0',
    reportedRate: '8.09',
  });
  expect(data.compounding).toBe('not-declared-in-table');
  expect(() =>
    parseCcilZeroPoints(
      body.replace('"zerorate00": 5.36', '"zerorate00": 5.36, "zerorate00": 6'),
    ),
  ).toThrow();
  expect(() =>
    parseCcilZeroPoints(
      body.replace('"zerorate_50_5": 0.0', '"zerorate_50_5": 1'),
    ),
  ).toThrow();
});
test.describe('Reported points actual storage', () => {
  test.use({ namedOperators: true, ccilZeroSimulation: true });
  test('E2E-API-1974 actual original point capture review read and source substitution denial @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilZeroFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const input = {
        requestId: randomUUID(),
        sourceUrl: CCIL_ZERO_RATES_URL,
        body: await ccilZeroPointsHtml(),
      };
      expect(
        (
          await request.post('/api/v1/ops/bond-zero-curve/import', {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/bond-zero-curve/${input.requestId}/review`,
            {
              headers,
              data: {
                requestId: randomUUID(),
                decision: 'publish',
                reason: 'Independently reviewed actual source numeric points.',
              },
            },
          )
        ).status(),
      ).toBe(201);
      const source = (
        await (await request.get('/api/v1/bond-zero-curve')).json()
      ).editions.find((e: { id: string }) => e.id === input.requestId);
      expect(source.data.rows[0].points[20]).toEqual({
        maturityLabel: '10.0',
        reportedRate: '7.11',
      });
      expect(
        (
          await request.post('/api/v1/ops/bond-zero-curve/import', {
            headers,
            data: {
              ...input,
              sourceUrl: 'https://www.ccilindia.com/en/zcyc-parameters',
            },
          })
        ).status(),
      ).toBe(409);
    } finally {
      await f.reviewer.dispose();
    }
  });
});

test.describe('Curve history continuation', () => {
  test.use({ namedOperators: true, ccilZeroSimulation: true });
  test('E2E-API-1975 equal timestamp101 editions paginate without loss while complete snapshot refuses truncation @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilZeroFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const { ccilZeroVolume } = await import('../../helpers/ccil-zero-curve');
      await ccilZeroVolume(feedbackSandbox, f.id);
      for (const path of [
        '/api/v1/bond-zero-curve',
        '/api/v1/ops/bond-zero-curve',
      ]) {
        const ids: string[] = [];
        let cursor: string | null = null;
        do {
          const response = await request.get(path, {
            params: cursor ? { cursor, limit: 30 } : { limit: 30 },
          });
          expect(response.status()).toBe(200);
          const data = await response.json();
          expect(data.editions.length).toBeLessThanOrEqual(30);
          ids.push(...data.editions.map((e: { id: string }) => e.id));
          cursor = data.nextCursor;
          expect(ids.length).toBeLessThanOrEqual(101);
        } while (cursor);
        expect(ids).toHaveLength(101);
        expect(new Set(ids).size).toBe(101);
        expect(
          (await request.get(path, { params: { cursor: 'invalid' } })).status(),
        ).toBe(400);
      }
      expect(
        (await request.get('/api/v1/bond-zero-curve/snapshot')).status(),
      ).toBe(503);
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-zero-curve/${f.id}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'withdraw',
              reason: 'Capacity never prevents actual withdrawal.',
            },
          })
        ).status(),
      ).toBe(201);
      expect(
        (await (await request.get('/api/v1/bond-zero-curve/snapshot')).json())
          .editions,
      ).toHaveLength(100);
    } finally {
      await f.reviewer.dispose();
    }
  });
});

test.describe('CCIL decoded body limit', () => {
  test.use({ namedOperators: true, ccilZeroSimulation: true });
  test('E2E-API-1977 escaped whitespace survives JSON transport while oversized UTF8 never reaches retention @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilZeroFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    try {
      const original = ccilZeroHtml(),
        body =
          original + '\t'.repeat(500000 - Buffer.byteLength(original, 'utf8')),
        id = randomUUID();
      expect(Buffer.byteLength(body, 'utf8')).toBe(500000);
      expect(
        Buffer.byteLength(JSON.stringify({ requestId: id, body }), 'utf8'),
      ).toBeGreaterThan(600000);
      const retained = await request.post(
        '/api/v1/ops/bond-zero-curve/import',
        { headers, data: { requestId: id, body } },
      );
      expect(retained.status()).toBe(201);
      expect((await retained.json()).state).toBe('draft');
      expect(
        (
          await (
            await request.get(`/api/v1/ops/bond-zero-curve/${id}/evidence`)
          ).json()
        ).body,
      ).toBe(body);
      const tooLarge = randomUUID();
      expect(
        (
          await request.post('/api/v1/ops/bond-zero-curve/import', {
            headers,
            data: { requestId: tooLarge, body: original + '€'.repeat(200000) },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await request.get(`/api/v1/ops/bond-zero-curve/${tooLarge}/evidence`)
        ).status(),
      ).toBe(404);
    } finally {
      await f.reviewer.dispose();
    }
  });
});

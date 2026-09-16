import { test, expect } from '../../helpers/app-fixture';
import {
  ResearchCatalogSchema,
  EcbRatePublicSchema,
  EcbFxPublicSchema,
  ReleaseCalendarSchema,
} from '../../../../packages/contracts/src/index';
test.use({ manualWorkers: true });
test('E2E-API-1350 actual initial global coverage distinguishes published editions and source-separated calendar captures @SRC-008', async ({
  request,
}) => {
  const catalog = ResearchCatalogSchema.parse(
    await (await request.get('/api/v1/discovery/catalog')).json(),
  );
  for (const id of [
    'fed',
    'fed-policy-history',
    'ecb-press',
    'ecb-statistics',
    'bls',
    'bea',
  ])
    expect(catalog.sources.some((source) => source.id === id)).toBe(true);
  for (const [path, schema] of [
    ['/api/v1/policy-rates', EcbRatePublicSchema],
    ['/api/v1/reference-fx', EcbFxPublicSchema],
  ] as const) {
    const value = schema.parse(await (await request.get(path)).json());
    expect(value.edition !== null).toBe(value.status === 'published');
  }
  for (const source of ['bea-calendar', 'bls-calendar']) {
    const value = ReleaseCalendarSchema.parse(
      await (
        await request.get('/api/v1/research-calendar?source=' + source)
      ).json(),
    );
    expect(value.sourceId).toBe(source);
    if (value.edition === null) expect(value.events).toEqual([]);
  }
});

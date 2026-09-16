import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  crosswalkFixture,
  crosswalkHeaders as headers,
} from '../../helpers/classification-crosswalk';
import {
  ClassificationCrosswalkPublicSchema,
  ClassificationCrosswalkHistorySchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1360 actual classification edition binds independent mapping review replay and withdrawal @SRC-006 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await crosswalkFixture(request, playwright, feedbackSandbox);
  try {
    const path = '/api/v1/ops/classification-crosswalks/' + fixture.id,
      review = {
        requestId: randomUUID(),
        expectedVersion: 1,
        decision: 'publish',
        reason:
          'Independent review of retained source label and application mapping.',
      };
    expect(
      (
        await request.post(path + '/reviews', { headers, data: review })
      ).status(),
    ).toBe(403);
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const published = ClassificationCrosswalkPublicSchema.parse(
      await (
        await request.get('/api/v1/classifications/' + fixture.input.isin)
      ).json(),
    );
    expect(published.mappings[0]?.input.applicationSector).toBe(
      'Synthetic application sector',
    );
    expect(published.mappings[0]?.source.observation.kind).toBe(
      'classification',
    );
    expect(
      (
        await request.put(
          '/api/v1/ops/classification-crosswalks/' + randomUUID(),
          {
            headers,
            data: {
              ...fixture.input,
              requestId: randomUUID(),
              providerLabel: 'Made up label',
            },
          },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: {
            ...review,
            requestId: randomUUID(),
            decision: 'withdraw',
            reason: 'Synthetic withdrawal of application crosswalk.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      ClassificationCrosswalkPublicSchema.parse(
        await (
          await request.get('/api/v1/classifications/' + fixture.input.isin)
        ).json(),
      ).mappings,
    ).toEqual([]);
    expect(
      ClassificationCrosswalkHistorySchema.parse(
        await (await request.get(path + '/history')).json(),
      ).reviews.length,
    ).toBe(2);
  } finally {
    await fixture.reviewer.dispose();
  }
});

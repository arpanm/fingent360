import { randomUUID } from 'node:crypto';
import {
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import { EquityCompanySchema } from '../../../packages/contracts/src/index';
import { equityInput, retentionHeaders as headers } from './equity-coverage';
import type { FeedbackSandbox } from './feedback-fixture';
export { headers as crosswalkHeaders };
export async function crosswalkFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: sandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: 'crosswalk_' + randomUUID().slice(0, 8),
    password: 'Synthetic-crosswalk-reviewer-2026',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const reviewer = await playwright.request.newContext({
    baseURL: sandbox.apiOrigin,
  });
  try {
    expect(
      (
        await reviewer.post('/api/v1/ops/session', {
          headers,
          data: credentials,
        })
      ).status(),
    ).toBe(200);
    const edition = await equityInput();
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers,
          data: edition,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: edition.requestId,
            decision: 'publish',
            reason:
              'Independent review of synthetic source fixtures; no live licence.',
          },
        })
      ).status(),
    ).toBe(201);
    const company = EquityCompanySchema.parse(
        await (await request.get('/api/v1/equities/INE002A01018')).json(),
      ),
      source = company.records.find(
        (r) => r.observation.kind === 'classification',
      )!;
    const id = randomUUID(),
      input = {
        requestId: randomUUID(),
        expectedVersion: 0,
        isin: company.isin,
        editionId: source.editionId,
        hash: source.hash,
        providerLabel: 'Synthetic industry',
        effectiveOn: source.observation.effectiveOn,
        applicationSector: 'Synthetic application sector',
        rationale:
          'Synthetic application classification, not an official NSE taxonomy assignment.',
        reviewBy: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
      };
    expect(
      (
        await request.put('/api/v1/ops/classification-crosswalks/' + id, {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(200);
    return { id, input, credentials, reviewer };
  } catch (error) {
    await reviewer.dispose();
    throw error;
  }
}

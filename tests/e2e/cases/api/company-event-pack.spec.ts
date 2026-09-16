import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { companyEventFixture } from '../../helpers/company-event-pack';
import { eventHeaders } from '../../helpers/event-fixture';
import {
  CompanyPackDraftSchema,
  GovernancePackDraftSchema,
  EventScenarioReceiptSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-API-1394 actual issuer revenue row separates quarterly values from annual columns and canonical identity @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const event = await companyEventFixture(request, feedbackSandbox),
    draft = CompanyPackDraftSchema.parse(
      await (
        await request.get(
          '/api/v1/ops/event-scenarios/company-draft/' + event.id,
        )
      ).json(),
    );
  const input = {
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: event.id,
      eventVersion: draft.eventVersion,
      revisionReason: 'Original IFRS quarterly revenue comparison.',
      model: draft.earnings,
    },
    response = await request.put(
      '/api/v1/ops/event-scenarios/' + randomUUID(),
      { headers: eventHeaders, data: input },
    );
  expect(response.status(), await response.text()).toBe(200);
  const receipt = EventScenarioReceiptSchema.parse(await response.json());
  expect(receipt.result.delta).toBe('3002');
  expect(receipt.result.unit).toBe('INR-crore');
  if (input.model.family !== 'earnings') throw Error('Expected earnings.');
  expect(
    (
      await request.put('/api/v1/ops/event-scenarios/' + randomUUID(), {
        headers: eventHeaders,
        data: {
          ...input,
          requestId: randomUUID(),
          model: {
            ...input.model,
            observed: { ...input.model.observed, value: '162990' },
          },
        },
      })
    ).status(),
  ).toBe(400);
});
test('E2E-API-1395 actual guidance preserves separate constant-currency range bounds without realised earnings or cross-bound delta @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const event = await companyEventFixture(request, feedbackSandbox),
    draft = CompanyPackDraftSchema.parse(
      await (
        await request.get(
          '/api/v1/ops/event-scenarios/company-draft/' + event.id,
        )
      ).json(),
    );
  for (const model of [draft.guidanceLower, draft.guidanceUpper]) {
    const response = await request.put(
      '/api/v1/ops/event-scenarios/' + randomUUID(),
      {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          eventId: event.id,
          eventVersion: draft.eventVersion,
          revisionReason: 'Original constant-currency guidance bounds.',
          model,
        },
      },
    );
    expect(response.status()).toBe(200);
    const receipt = EventScenarioReceiptSchema.parse(await response.json());
    expect(receipt.result.delta).toBeNull();
    expect(receipt.result.warnings.join(' ')).toContain('forward-looking');
  }
});
test('E2E-API-1396 original FIU disclosure retains bank subject and yields regulatory context without portfolio arithmetic @EVENT-SCENARIOS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const event = await companyEventFixture(request, feedbackSandbox, true),
    draft = GovernancePackDraftSchema.parse(
      await (
        await request.get(
          '/api/v1/ops/event-scenarios/governance-draft/' + event.id,
        )
      ).json(),
    );
  const response = await request.put(
    '/api/v1/ops/event-scenarios/' + randomUUID(),
    {
      headers: eventHeaders,
      data: {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId: event.id,
        eventVersion: draft.eventVersion,
        revisionReason: 'Historical original FIU bank-specific disclosure.',
        model: draft.model,
      },
    },
  );
  expect(response.status()).toBe(200);
  const receipt = EventScenarioReceiptSchema.parse(await response.json());
  expect(receipt.result.comparison).toBe('regulatory-context');
  expect(receipt.result.delta).toBeNull();
  expect(receipt.input.model).toMatchObject({
    interpretation: expect.stringContaining('Paytm Payments Bank Ltd'),
  });
});

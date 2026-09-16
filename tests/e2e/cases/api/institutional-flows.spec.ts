import { randomUUID } from 'node:crypto';
import { historicalFlowInput } from '../../helpers/institutional-flows';
import {
  test,
  expect,
  flowInput,
  flowActors,
  flowReview,
  retentionHeaders,
} from '../../helpers/institutional-flows';
import {
  FeedItemSchema,
  InstitutionalFlowDraftSchema,
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
  InstitutionalFlowPublicSchema,
  InstitutionalFlowQueueSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1430 retained flow sources independently publish exact scopes and dates replay withdraw @SRC-010 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await flowActors(request, playwright, feedbackSandbox);
  try {
    for (const source of ['nse-cash-html', 'cdsl-daily-html'] as const) {
      const input = await flowInput(source);
      const capture = await request.post(
        '/api/v1/ops/institutional-flows/capture',
        { headers: retentionHeaders, data: input },
      );
      expect(capture.status(), await capture.text()).toBe(201);
      expect((await capture.json()).state).toBe('retained');
      expect(
        await (
          await request.post('/api/v1/ops/institutional-flows/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).json(),
      ).toEqual(await capture.json());
      expect(
        (
          await request.post('/api/v1/ops/institutional-flows/review', {
            headers: retentionHeaders,
            data: flowReview(input.requestId),
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await reviewer.post('/api/v1/ops/institutional-flows/review', {
            headers: retentionHeaders,
            data: flowReview(input.requestId),
          })
        ).status(),
      ).toBe(201);
      const view = InstitutionalFlowPublicSchema.parse(
          await (await request.get('/api/v1/institutional-flows')).json(),
        ),
        edition = view.editions.find((e) => e.id === input.requestId)!;
      expect(edition.datasets).toHaveLength(2);
      expect(edition.bodyHash).toMatch(/^[a-f0-9]{64}$/);
      if (source === 'cdsl-daily-html')
        expect(edition.datasets.map((d) => d.effectiveOn)).toEqual([
          '2024-08-30',
          '2026-09-10',
        ]);
      expect(
        (
          await (
            await request.get(
              `/api/v1/ops/institutional-flows/${input.requestId}/evidence`,
            )
          ).json()
        ).body,
      ).toBe(input.body);
      expect(
        (
          await reviewer.post('/api/v1/ops/institutional-flows/review', {
            headers: retentionHeaders,
            data: flowReview(input.requestId, 'withdraw'),
          })
        ).status(),
      ).toBe(201);
      expect(
        InstitutionalFlowPublicSchema.parse(
          await (await request.get('/api/v1/institutional-flows')).json(),
        ).editions.some((e) => e.source === source),
      ).toBe(false);
    }
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1431 changed flow units and arithmetic retain quarantine originals without publishing @SRC-010 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await flowActors(request, playwright, feedbackSandbox);
  try {
    const input = await flowInput();
    input.body = input.body.replace('₹ Crores', '₹ lakh');
    const response = await request.post(
      '/api/v1/ops/institutional-flows/capture',
      { headers: retentionHeaders, data: input },
    );
    expect((await response.json()).state).toBe('quarantined');
    const queue = InstitutionalFlowQueueSchema.parse(
      await (await request.get('/api/v1/ops/institutional-flows')).json(),
    );
    expect(queue.find((r) => r.id === input.requestId)?.error).toContain(
      'layout',
    );
    expect(
      (
        await reviewer.post('/api/v1/ops/institutional-flows/review', {
          headers: retentionHeaders,
          data: flowReview(input.requestId),
        })
      ).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1433 historical numerical flow golden follows capture independent source event scenario review and withdrawal @SRC-010 @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await flowActors(request, playwright, feedbackSandbox);
  try {
    const input = historicalFlowInput();
    expect(
      (
        await request.post('/api/v1/ops/institutional-flows/capture', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/institutional-flows/review', {
          headers: retentionHeaders,
          data: flowReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    const source = FeedItemSchema.parse(
        await (
          await request.get(
            '/api/v1/discovery/items/institutional-flow-' + input.requestId,
          )
        ).json(),
      ),
      quote = source.body
        .split('\n')
        .find(
          (line) =>
            line.startsWith('NSE-BSE-MSEI |') && line.includes('| FII/FPI |'),
        )!;
    expect(quote).toContain('-930.90');
    const eventId = randomUUID(),
      eventInput = {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason:
          'Reconstructed golden table through real capture and independent source review.',
        editorial: {
          title:
            'Historical combined exchange FII/FPI provisional cash activity',
          family: 'flows',
          geography: ['India'],
          claimKind: 'fact',
          explanation:
            'Exact combined provisional net on its trade date, without adding NSE-only amounts.',
          announcedAt: null,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: source.version,
              hash: source.sourceHash,
              field: 'body',
              quote,
            },
          ],
          links: [],
        },
      };
    expect(
      (
        await request.put('/api/v1/ops/events/' + eventId, {
          headers: retentionHeaders,
          data: eventInput,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await reviewer.post(`/api/v1/ops/events/${eventId}/review`, {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            status: 'published',
            note: 'Independent exact scope/date numerical row review.',
          },
        })
      ).status(),
    ).toBe(201);
    const draft = InstitutionalFlowDraftSchema.parse(
      await (
        await request.get('/api/v1/ops/event-scenarios/flows-draft/' + eventId)
      ).json(),
    );
    expect(draft.model).toMatchObject({
      family: 'flows',
      participant: 'FII/FPI',
      observed: {
        value: '-930.90',
        period: 'NSE-BSE-MSEI | provisional trade date 2026-09-11',
      },
      reference: null,
    });
    const scenarioId = randomUUID(),
      scenario = {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId,
        eventVersion: draft.eventVersion,
        revisionReason:
          'Exact independently admitted historical net; no invented comparison.',
        model: draft.model,
      };
    const saved = await request.put(
      '/api/v1/ops/event-scenarios/' + scenarioId,
      { headers: retentionHeaders, data: scenario },
    );
    expect(saved.status(), await saved.text()).toBe(200);
    expect(
      EventScenarioReceiptSchema.parse(await saved.json()).result,
    ).toMatchObject({ comparison: 'no-reference', delta: null });
    expect(
      (
        await reviewer.post(
          `/api/v1/ops/event-scenarios/${scenarioId}/review`,
          {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              decision: 'publish',
              reason: 'Independent net and source-scope verification.',
            },
          },
        )
      ).status(),
    ).toBe(201);
    expect(
      EventScenarioPublicSchema.parse(
        await (
          await request.get('/api/v1/event-scenarios/' + scenarioId)
        ).json(),
      ).receipt?.input.model,
    ).toEqual(draft.model);
    if (draft.model.family !== 'flows') throw Error('Expected flows.');
    expect(
      (
        await request.put('/api/v1/ops/event-scenarios/' + randomUUID(), {
          headers: retentionHeaders,
          data: {
            ...scenario,
            requestId: randomUUID(),
            model: {
              ...draft.model,
              observed: { ...draft.model.observed, value: '-978.60' },
            },
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await reviewer.post('/api/v1/ops/institutional-flows/review', {
          headers: retentionHeaders,
          data: flowReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      EventScenarioPublicSchema.parse(
        await (
          await request.get('/api/v1/event-scenarios/' + scenarioId)
        ).json(),
      ).receipt,
    ).toBeNull();
  } finally {
    await reviewer.dispose();
  }
});

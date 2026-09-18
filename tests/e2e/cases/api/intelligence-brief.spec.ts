import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  intelligenceBriefFixture,
  headers,
} from '../../helpers/intelligence-brief';
import { publishNamedEvent } from '../../helpers/publish-named-event';
import {
  IntelligenceBriefPublicSchema,
  IntelligenceBriefHistorySchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1520 five actual-source points require independent issue and suppress a withdrawn source point without rewriting the brief @DEV-006 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await intelligenceBriefFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const path = '/api/v1/ops/intelligence-briefs/' + f.id,
      review = {
        requestId: randomUUID(),
        expectedVersion: 1,
        decision: 'publish',
        reason: 'Independent five-point source/version review.',
      };
    expect(
      (
        await request.post(path + '/review', { headers, data: review })
      ).status(),
    ).toBe(403);
    expect(
      (
        await f.reviewer.post(path + '/review', { headers, data: review })
      ).status(),
    ).toBe(201);
    const initial = IntelligenceBriefPublicSchema.parse(
      await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
    );
    expect(initial.points).toHaveLength(5);
    expect(initial.points.every((point) => point.status === 'current')).toBe(
      true,
    );
    expect(
      initial.points.some((point) =>
        point.reasons.some((reason) => reason.includes('Historical')),
      ),
    ).toBe(true);
    expect((await request.put(path, { headers, data: f.input })).status()).toBe(
      200,
    );
    expect(
      (
        await request.put('/api/v1/ops/intelligence-briefs/' + randomUUID(), {
          headers,
          data: {
            ...f.input,
            requestId: randomUUID(),
            events: f.input.events.slice(0, 4),
          },
        })
      ).status(),
    ).toBe(400);
    const sourceId = f.source.id.slice('oil-education-'.length);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/oil-education/review', {
          headers,
          data: {
            requestId: randomUUID(),
            id: sourceId,
            decision: 'withdraw',
            reason: 'Original issuer source permission withdrawn in test.',
            rightsVerified: false,
          },
        })
      ).status(),
    ).toBe(201);
    const changed = IntelligenceBriefPublicSchema.parse(
      await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
    );
    expect(changed.version).toBe(initial.version);
    expect(
      changed.points.find((point) => point.id === f.event.id),
    ).toMatchObject({ status: 'unavailable', event: null });
    expect(
      changed.points.filter((point) => point.status === 'current'),
    ).toHaveLength(4);
    expect(
      (
        await f.reviewer.post(path + '/review', {
          headers,
          data: { ...review, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
    expect(
      IntelligenceBriefHistorySchema.parse(
        await (
          await request.get('/api/v1/intelligence-briefs/' + f.id + '/history')
        ).json(),
      ).versions.map((v) => v.version),
    ).toEqual([1]);
    expect(
      (
        await f.reviewer.post(path + '/review', {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            decision: 'withdraw',
            reason: 'Withdraw the now-incomplete historical editorial brief.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      IntelligenceBriefPublicSchema.parse(
        await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
      ).points,
    ).toEqual([]);
  } finally {
    await f.reviewer.dispose();
  }
});

test('E2E-API-1521 corrected reviewed event requires new independent brief version while issued history stays immutable @DEV-006 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await intelligenceBriefFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const path = '/api/v1/ops/intelligence-briefs/' + f.id;
    expect(
      (
        await f.reviewer.post(path + '/review', {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            decision: 'publish',
            reason: 'Independent original historical brief issue.',
          },
        })
      ).status(),
    ).toBe(201);
    const old = f.events[1]!,
      changed = {
        ...old.event!.editorial,
        title: old.event!.editorial.title + ' — clarified historical context',
      };
    expect(
      (
        await request.put('/api/v1/ops/events/' + old.id, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: old.event!.version,
            revisionReason:
              'Clarify historical title without changing source evidence.',
            editorial: changed,
          },
        })
      ).status(),
    ).toBe(200);
    const corrected = await publishNamedEvent(
      request,
      f.reviewer,
      old.id,
      'Independent historical title clarification review.',
      old.event!.version + 1,
    );
    expect(corrected.event?.editorial.title).toBe(changed.title);
    const pending = IntelligenceBriefPublicSchema.parse(
      await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
    );
    expect(pending.points.find((point) => point.id === old.id)).toMatchObject({
      status: 'changed',
      event: null,
    });
    const next = {
      ...f.input,
      requestId: randomUUID(),
      expectedVersion: 1,
      reason:
        'Explicit corrected event edition replaces the older brief point.',
      events: f.input.events.map((event) =>
        event.id === old.id
          ? { ...event, version: corrected.event!.version }
          : event,
      ),
    };
    expect((await request.put(path, { headers, data: next })).status()).toBe(
      200,
    );
    expect(
      (
        await f.reviewer.post(path + '/review', {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 2,
            decision: 'publish',
            reason: 'Independent corrected five-point brief issue.',
          },
        })
      ).status(),
    ).toBe(201);
    const issued = IntelligenceBriefPublicSchema.parse(
      await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
    );
    expect(issued.version).toBe(2);
    expect(issued.points.every((point) => point.status === 'current')).toBe(
      true,
    );
    expect(
      IntelligenceBriefHistorySchema.parse(
        await (
          await request.get('/api/v1/intelligence-briefs/' + f.id + '/history')
        ).json(),
      ).versions.map((row) => row.version),
    ).toEqual([2, 1]);
  } finally {
    await f.reviewer.dispose();
  }
});

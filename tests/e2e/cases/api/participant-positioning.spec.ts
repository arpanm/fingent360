import {
  test,
  expect,
  positioningInput,
  positioningReview,
  indiaActors,
  retentionHeaders,
} from '../../helpers/participant-positioning';
import {
  PositioningCaptureSchema,
  PositioningPublicSchema,
  PositioningQueueSchema,
} from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
test.use({ namedOperators: true });
test('E2E-API-1391 original OI capture reconciles retains reviews independently replays and withdraws @SRC-011 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = positioningInput();
    for (let i = 0; i < 2; i++) {
      const response = await request.post('/api/v1/ops/positioning/capture', {
        headers: retentionHeaders,
        data: input,
      });
      expect(response.status(), await response.text()).toBe(201);
      expect(PositioningCaptureSchema.parse(await response.json()).state).toBe(
        'retained',
      );
    }
    expect(
      PositioningPublicSchema.parse(
        await (await request.get('/api/v1/positioning')).json(),
      ).editions,
    ).toEqual([]);
    const review = positioningReview(input.requestId);
    expect(
      (
        await request.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await reviewer.post('/api/v1/ops/positioning/review', {
            headers: retentionHeaders,
            data: review,
          })
        ).status(),
      ).toBe(201);
    const snapshot = PositioningPublicSchema.parse(
      await (await request.get('/api/v1/positioning')).json(),
    );
    expect(snapshot.editions[0]?.rows[4]?.counts.slice(-2)).toEqual([
      '24',
      '24',
    ]);
    expect(snapshot.editions[0]?.unit).toBe('contracts');
    expect(JSON.stringify(snapshot)).not.toContain(input.rightsEvidence);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/positioning/${input.requestId}/evidence`,
          )
        ).json()
      ).csv,
    ).toBe(input.csv);
    expect(
      (
        await reviewer.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: positioningReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      PositioningPublicSchema.parse(
        await (await request.get('/api/v1/positioning')).json(),
      ).editions,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1392 inconsistent OI totals and title dates remain durable quarantined originals and cannot publish @SRC-011 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = positioningInput();
    input.csv = input.csv.replace('Client,1,', 'Client,2,');
    const response = await request.post('/api/v1/ops/positioning/capture', {
      headers: retentionHeaders,
      data: input,
    });
    expect(response.status()).toBe(201);
    expect(PositioningCaptureSchema.parse(await response.json()).state).toBe(
      'quarantined',
    );
    const queue = PositioningQueueSchema.parse(
      await (await request.get('/api/v1/ops/positioning')).json(),
    );
    expect(queue.find((row) => row.id === input.requestId)?.error).toContain(
      'reconcile',
    );
    expect(
      (
        await reviewer.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: positioningReview(input.requestId),
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post('/api/v1/ops/positioning/capture', {
          headers: retentionHeaders,
          data: { ...input, csv: positioningInput().csv },
        })
      ).status(),
    ).toBe(409);
    const dated = positioningInput();
    dated.requestId = randomUUID();
    dated.csv = dated.csv.replace('Jun 06', 'Jun 07');
    expect(
      PositioningCaptureSchema.parse(
        await (
          await request.post('/api/v1/ops/positioning/capture', {
            headers: retentionHeaders,
            data: dated,
          })
        ).json(),
      ).state,
    ).toBe('quarantined');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1393 same-day new OI vintage survives older withdrawal without resurrecting old data after its own withdrawal @SRC-011 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const first = positioningInput(),
      second = positioningInput();
    for (const input of [first, second]) {
      expect(
        (
          await request.post('/api/v1/ops/positioning/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/positioning/review', {
            headers: retentionHeaders,
            data: positioningReview(input.requestId),
          })
        ).status(),
      ).toBe(201);
    }
    expect(
      (
        await reviewer.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: positioningReview(first.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      PositioningPublicSchema.parse(
        await (await request.get('/api/v1/positioning')).json(),
      ).editions.map((row) => row.id),
    ).toEqual([second.requestId]);
    expect(
      (
        await reviewer.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: positioningReview(second.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      PositioningPublicSchema.parse(
        await (await request.get('/api/v1/positioning')).json(),
      ).editions,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});

import { createHash, randomUUID } from 'node:crypto';
import {
  test,
  expect,
  indiaActors,
  retentionHeaders as headers,
  indexLevelInput,
  indexLevelReview,
} from '../../helpers/index-levels';
import {
  IndexLevelCaptureSchema,
  IndexLevelPublicSchema,
  IndexLevelQueueSchema,
} from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-1950 index originals exact replay independent publication correction and withdrawal retain provenance @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indexLevelInput();
    for (let i = 0; i < 2; i++) {
      const response = await request.post('/api/v1/ops/index-levels/capture', {
        headers,
        data: input,
      });
      expect(response.status()).toBe(201);
      expect(IndexLevelCaptureSchema.parse(await response.json()).state).toBe(
        'retained',
      );
    }
    const credentials = {
      username: `index_${randomUUID().slice(0, 8)}`,
      password: 'Synthetic-index-replay-2026-password',
    };
    expect(
      (
        await request.post('/api/v1/ops/operators', {
          headers,
          data: { ...credentials, role: 'researcher' },
        })
      ).status(),
    ).toBe(201);
    const other = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      expect(
        (
          await other.post('/api/v1/ops/session', {
            headers,
            data: credentials,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await other.post('/api/v1/ops/index-levels/capture', {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(409);
    } finally {
      await other.dispose();
    }
    const read = async () =>
      IndexLevelPublicSchema.parse(
        await (await request.get('/api/v1/index-levels')).json(),
      );
    expect((await read()).editions).toEqual([]);
    const review = indexLevelReview(input.requestId);
    expect(
      (
        await request.post('/api/v1/ops/index-levels/review', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/index-levels/review', {
          headers,
          data: { ...review, rightsVerified: false },
        })
      ).status(),
    ).toBe(403);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await reviewer.post('/api/v1/ops/index-levels/review', {
            headers,
            data: review,
          })
        ).status(),
      ).toBe(201);
    const issued = (await read()).editions[0]!;
    expect(issued.sourceHash).toBe(
      createHash('sha256').update(input.csv).digest('hex'),
    );
    expect(issued.rows).toHaveLength(3);
    expect(issued.rows[0]?.percentChange).toBe('0.25');
    expect(issued.rows[0]?.close).toBe('100.25');
    expect(issued.unit).toBe('index_points');
    expect(JSON.stringify(issued)).not.toContain(input.rightsEvidence);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/index-levels/${input.requestId}/evidence`,
          )
        ).json()
      ).csv,
    ).toBe(input.csv);
    expect(
      (
        await request.post('/api/v1/ops/index-levels/capture', {
          headers,
          data: {
            ...input,
            rightsEvidence: 'Different recorded permission basis for replay',
          },
        })
      ).status(),
    ).toBe(409);
    const correction = indexLevelInput('2026-09-18', '100.5');
    expect(
      (
        await request.post('/api/v1/ops/index-levels/capture', {
          headers,
          data: correction,
        })
      ).status(),
    ).toBe(201);
    expect((await read()).editions[0]?.id).toBe(input.requestId);
    expect(
      (
        await reviewer.post('/api/v1/ops/index-levels/review', {
          headers,
          data: indexLevelReview(correction.requestId),
        })
      ).status(),
    ).toBe(201);
    expect((await read()).editions[0]?.id).toBe(correction.requestId);
    expect((await read()).editions).toHaveLength(1);
    expect(
      (
        await reviewer.post('/api/v1/ops/index-levels/review', {
          headers,
          data: indexLevelReview(correction.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect((await read()).editions).toEqual([]);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/index-levels/${input.requestId}/evidence`,
          )
        ).json()
      ).csv,
    ).toBe(input.csv);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1951 unknown layout identity dates missing values and unreconciled OHLC quarantine actual retained captures @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const original = indexLevelInput();
    for (const csv of [
      original.csv.replace('Open Index Value', 'Invented Open'),
      original.csv.replace('18-09-2026', '17-09-2026'),
      original.csv.replace('Nifty Bank,', 'Nifty 50,'),
      original.csv.replace('Nifty IT,', 'Nifty IT Total Returns,'),
      original.csv.replace(',100,101,99,', ',100,98,99,'),
      original.csv.replace(',100,101,99,', ',,101,99,'),
    ]) {
      const input = { ...original, requestId: randomUUID(), csv };
      const response = await request.post('/api/v1/ops/index-levels/capture', {
        headers,
        data: input,
      });
      expect(response.status()).toBe(201);
      expect(IndexLevelCaptureSchema.parse(await response.json()).state).toBe(
        'quarantined',
      );
      expect(
        (
          await reviewer.post('/api/v1/ops/index-levels/review', {
            headers,
            data: indexLevelReview(input.requestId),
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await (
            await request.get(
              `/api/v1/ops/index-levels/${input.requestId}/evidence`,
            )
          ).json()
        ).csv,
      ).toBe(csv);
    }
    const queue = IndexLevelQueueSchema.parse(
      await (await request.get('/api/v1/ops/index-levels')).json(),
    );
    expect(queue.items).toHaveLength(6);
    expect(
      queue.items.every(
        (row) => row.state === 'quarantined' && row.receipt === null,
      ),
    ).toBe(true);
    expect(
      (
        await request.post('/api/v1/ops/index-levels/capture', {
          headers,
          data: {
            ...original,
            sourceUrl: 'https://example.com/' + original.filename,
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (await request.get('/api/v1/index-levels?before=bad')).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/v1/ops/index-levels/capture', {
          headers,
          data: {
            ...original,
            requestId: randomUUID(),
            csv: 'é'.repeat(1_000_001),
          },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1952 reviewed daily index history pages without repeating or silently replacing dates @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    for (let day = 1; day <= 21; day++) {
      const input = indexLevelInput(`2026-08-${String(day).padStart(2, '0')}`);
      expect(
        (
          await request.post('/api/v1/ops/index-levels/capture', {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/index-levels/review', {
            headers,
            data: indexLevelReview(input.requestId),
          })
        ).status(),
      ).toBe(201);
    }
    const first = IndexLevelPublicSchema.parse(
      await (await request.get('/api/v1/index-levels')).json(),
    );
    expect(first.editions).toHaveLength(20);
    expect(first.nextBefore).toBe('2026-08-02');
    const next = IndexLevelPublicSchema.parse(
      await (
        await request.get('/api/v1/index-levels?before=' + first.nextBefore)
      ).json(),
    );
    expect(next.editions.map((row) => row.effectiveOn)).toEqual(['2026-08-01']);
    expect(next.nextBefore).toBeNull();
    const snapshot = IndexLevelPublicSchema.parse(
      await (await request.get('/api/v1/index-levels/snapshot')).json(),
    );
    expect(snapshot.editions).toHaveLength(21);
    expect(snapshot.nextBefore).toBeNull();
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1953 capture queue preserves tied microsecond timestamps and exact identity across continuation @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const { seedIndexQueue } = await import('../../helpers/index-levels');
    const ids = await seedIndexQueue(request, feedbackSandbox);
    const first = IndexLevelQueueSchema.parse(
      await (await request.get('/api/v1/ops/index-levels')).json(),
    );
    expect(first.items.map((row) => row.id)).toEqual(ids.slice(0, 20));
    expect(first.nextCursor).toBe('2026-09-18T12:00:00.123456Z|' + ids[19]);
    const next = IndexLevelQueueSchema.parse(
      await (
        await request.get(
          '/api/v1/ops/index-levels?cursor=' +
            encodeURIComponent(first.nextCursor!),
        )
      ).json(),
    );
    expect(next.items.map((row) => row.id)).toEqual(ids.slice(20));
    expect(next.nextCursor).toBeNull();
    expect(
      IndexLevelQueueSchema.parse(
        await (await request.get('/api/v1/ops/index-levels')).json(),
      ).items.map((row) => row.id),
    ).toEqual(ids.slice(0, 20));
    expect(
      (await request.get('/api/v1/ops/index-levels?cursor=bad')).status(),
    ).toBe(400);
    expect(
      (await request.get('/api/v1/ops/index-levels?unexpected=true')).status(),
    ).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});

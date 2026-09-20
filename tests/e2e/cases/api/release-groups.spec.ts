import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import { publishNamedEvent } from '../../helpers/publish-named-event';
import { seedReleaseSources, releaseInput } from '../../helpers/release-groups';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { ReleaseGroupsSchema } from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-API-2300 explicit distinct-release grouping independent issue ungroup reissue withdrawal @UX-002C @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const sources = await seedReleaseSources(feedbackSandbox),
      pair = sources.slice(0, 2),
      id = randomUUID();
    const path = `/api/v1/ops/events/${id}`;
    const read = async () =>
      ReleaseGroupsSchema.parse(
        await (
          await request.get(
            `/api/v1/events/release-groups?sources=${sources.map((source) => source.id).join(',')}`,
          )
        ).json(),
      );
    expect(
      (await request.put(path, { headers, data: releaseInput(pair) })).status(),
    ).toBe(200);
    expect((await read()).groups).toEqual([]);
    await publishNamedEvent(
      request,
      reviewer,
      id,
      'Independent synthetic same-event review',
    );
    const issued = (await read()).groups;
    expect(issued).toHaveLength(1);
    expect(issued[0]?.members).toEqual(
      pair.map((source) => ({
        id: source.id,
        version: source.version,
        sourceHash: source.sourceHash,
      })),
    );
    expect(
      issued[0]?.members.some((member) => member.id === sources[2]!.id),
    ).toBe(false);
    expect(
      (
        await request.put(path, { headers, data: releaseInput(pair, 2, false) })
      ).status(),
    ).toBe(200);
    expect((await read()).groups).toHaveLength(1);
    await publishNamedEvent(
      request,
      reviewer,
      id,
      'Independent synthetic ungroup review',
      3,
    );
    expect((await read()).groups).toEqual([]);
    expect(
      (
        await request.put(path, { headers, data: releaseInput(pair, 4) })
      ).status(),
    ).toBe(200);
    await publishNamedEvent(
      request,
      reviewer,
      id,
      'Independent synthetic regroup review',
      5,
    );
    expect((await read()).groups[0]?.eventVersion).toBe(6);
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      const history = await pool.query(
        'SELECT version,payload FROM reviewed_event_versions WHERE event_id=$1 AND version IN (2,4) ORDER BY version',
        [id],
      );
      expect(history.rows[0].payload.editorial.releaseGroup.sourceIds).toEqual(
        pair.map((source) => source.id),
      );
      expect(history.rows[1].payload.editorial.releaseGroup).toBeUndefined();
    } finally {
      await pool.end();
    }
    await reviseConnectionSourceFixture(feedbackSandbox, pair[1]!, 'withdrawn');
    expect((await read()).groups).toEqual([]);
    expect(
      (await request.get(`/api/v1/discovery/items/${sources[0]!.id}`)).status(),
    ).toBe(200);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-2301 grouping rejects malformed selections and suppresses ambiguous memberships @UX-002C @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const sources = await seedReleaseSources(feedbackSandbox),
      input = releaseInput(sources.slice(0, 2));
    for (const editorial of [
      { ...input.editorial, claimKind: 'inference' },
      {
        ...input.editorial,
        releaseGroup: {
          ...input.editorial.releaseGroup,
          sourceIds: [sources[0]!.id, sources[0]!.id],
        },
      },
      {
        ...input.editorial,
        releaseGroup: {
          ...input.editorial.releaseGroup,
          sourceIds: [sources[0]!.id, sources[2]!.id],
        },
      },
      {
        ...input.editorial,
        releaseGroup: { ...input.editorial.releaseGroup, inferred: true },
      },
    ])
      expect(
        (
          await request.put(`/api/v1/ops/events/${randomUUID()}`, {
            headers,
            data: { ...input, requestId: randomUUID(), editorial },
          })
        ).status(),
      ).toBe(400);
    for (const pair of [sources.slice(0, 2), sources.slice(1)]) {
      const id = randomUUID();
      expect(
        (
          await request.put(`/api/v1/ops/events/${id}`, {
            headers,
            data: releaseInput(pair),
          })
        ).status(),
      ).toBe(200);
      await publishNamedEvent(
        request,
        reviewer,
        id,
        'Independent synthetic overlapping-group review',
      );
    }
    const value = ReleaseGroupsSchema.parse(
      await (
        await request.get(
          `/api/v1/events/release-groups?sources=${sources[0]!.id}`,
        )
      ).json(),
    );
    expect(value.groups).toEqual([]);
    expect(value.conflicted).toBe(true);
    expect(
      (
        await request.get(
          `/api/v1/events/release-groups?sources=${sources[0]!.id}&unexpected=true`,
        )
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.get(
          `/api/v1/events/release-groups?sources=${sources[0]!.id},${sources[0]!.id}`,
        )
      ).status(),
    ).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});

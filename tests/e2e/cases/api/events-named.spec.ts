import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventHeaders as headers,
} from '../../helpers/event-fixture';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
import {
  EventPublicSchema,
  PublicationProposalSchema,
} from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-API-702 event publication requires independent named identity and exact current draft @EVENT-REVIEW-001 @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await request.post('/api/v1/ops/session', {
    headers,
    data: feedbackSandbox.namedCredentials,
  });
  const credentials = {
    username: 'publisher_' + randomUUID().slice(0, 8),
    password: 'Synthetic-event-publisher-2026',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const publisher = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await publisher.post('/api/v1/ops/session', { headers, data: credentials });
    const id = randomUUID(),
      input = {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason: 'Synthetic source-bound event',
        editorial: {
          title: 'Synthetic independently reviewed event',
          family: 'Policy',
          geography: ['India'],
          claimKind: 'inference',
          explanation: 'Explicit synthetic context; no financial assertion.',
          announcedAt: null,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: source.version,
              hash: source.sourceHash,
              field: 'title',
              quote: source.title,
            },
          ],
          links: [],
        },
      };
    expect(
      (
        await request.put('/api/v1/ops/events/' + id, { headers, data: input })
      ).status(),
    ).toBe(200);
    const body = {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        note: 'Synthetic independent evidence review',
      },
      proposalId = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/events/' + id + '/review', {
          headers,
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + proposalId, {
          headers,
          data: { kind: 'event', target: id, body },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/proposals/' + proposalId + '/approve', {
          headers,
          data: { note: 'Same identity denied' },
        })
      ).status(),
    ).toBe(403);
    const response = await publisher.post(
      '/api/v1/ops/proposals/' + proposalId + '/approve',
      { headers, data: { note: 'Independent named event approval' } },
    );
    expect(response.status()).toBe(201);
    const receipt = PublicationProposalSchema.parse(await response.json());
    expect(receipt.state).toBe('approved');
    const event = EventPublicSchema.parse(
      await (await request.get('/api/v1/events/' + id)).json(),
    );
    expect(event.event?.version).toBe(2);
    expect(
      await (
        await publisher.post(
          '/api/v1/ops/proposals/' + proposalId + '/approve',
          { headers, data: { note: 'Independent named event approval' } },
        )
      ).json(),
    ).toEqual(receipt);
  } finally {
    await publisher.dispose();
  }
});

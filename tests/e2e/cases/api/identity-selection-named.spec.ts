import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventHeaders as headers,
  seedSelectionIdentity,
  saveSelection,
} from '../../helpers/identity-selection';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-API-874 exact candidate selection requires a different named identity and preserves provider ambiguity @IDENTITY-ADJUDICATION-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const provider = await seedSelectionIdentity(feedbackSandbox);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: 'selection_' + randomUUID().slice(0, 8),
    password: 'Synthetic-selection-publisher-2026',
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
    baseURL: feedbackSandbox.apiOrigin,
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
    const plan = await saveSelection(request, provider),
      id = randomUUID();
    const body = { fingerprint: plan.fingerprint, status: 'approved' };
    expect(
      (
        await request.post(
          '/api/v1/ops/identity-selections/' + plan.id + '/review',
          { headers, data: body },
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + id, {
          headers,
          data: { kind: 'identity-selection', target: plan.id, body },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/proposals/' + id + '/approve', {
          headers,
          data: { note: 'Same identity prohibited' },
        })
      ).status(),
    ).toBe(403);
    const approved = await reviewer.post(
      '/api/v1/ops/proposals/' + id + '/approve',
      { headers, data: { note: 'Independent candidate judgement reviewed.' } },
    );
    expect(approved.status()).toBe(201);
    const receipt = await approved.json();
    expect(
      await (
        await reviewer.post('/api/v1/ops/proposals/' + id + '/approve', {
          headers,
          data: { note: 'Independent candidate judgement reviewed.' },
        })
      ).json(),
    ).toEqual(receipt);
    expect(
      (await (await request.get('/api/v1/securities/' + provider.isin)).json())
        .resolution,
    ).toBe('ambiguous');
  } finally {
    await reviewer.dispose();
  }
});

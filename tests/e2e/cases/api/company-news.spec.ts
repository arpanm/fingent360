import {
  test,
  expect,
  prepareCompanyNews,
  reviewNews,
  retentionHeaders,
  companyNewsInput,
} from '../../helpers/company-news';
import {
  CompanyNewsQueueSchema,
  companyNewsReasons,
  CompanyNewsInputSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1300 company evidence retained and reviewed with replay, public proof and withdrawal @SRC-012 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { input, id, reviewer } = await prepareCompanyNews(
    request,
    playwright,
    feedbackSandbox,
  );
  expect((await request.get(`/api/v1/discovery/items/${id}`)).status()).toBe(
    404,
  );
  expect(
    (
      await request.post('/api/v1/ops/company-news/prepare', {
        headers: retentionHeaders,
        data: input,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/company-news/prepare', {
        headers: retentionHeaders,
        data: { ...input, title: 'Changed claim' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post('/api/v1/ops/company-news/review', {
        headers: retentionHeaders,
        data: reviewNews(id),
      })
    ).status(),
  ).toBe(403);
  const review = reviewNews(id);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await reviewer.post('/api/v1/ops/company-news/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
  const item = await (
    await request.get(`/api/v1/discovery/items/${id}`)
  ).json();
  expect(item.companyNews.sources).toHaveLength(2);
  expect(JSON.stringify(item)).not.toContain('permissionReference');
  const queue = CompanyNewsQueueSchema.parse(
    await (await request.get('/api/v1/ops/company-news')).json(),
  );
  expect(queue.items.find((row) => row.id === id)?.version).toBe(2);
  expect(
    (
      await reviewer.post('/api/v1/ops/company-news/review', {
        headers: retentionHeaders,
        data: reviewNews(id, 2, 'withdraw'),
      })
    ).status(),
  ).toBe(201);
  const withdrawn = await (
    await request.get(`/api/v1/discovery/items/${id}`)
  ).json();
  expect(withdrawn.companyNews).toBeUndefined();
  expect(withdrawn.body).toBe('');
  await reviewer.dispose();
});
test('E2E-API-1301 company rights and independent-originator policy rejects copied text, syndication, conflicts and stale checks @SRC-012 @TEST-SIMULATION', async () => {
  const input = CompanyNewsInputSchema.parse(companyNewsInput());
  expect(companyNewsReasons(input, new Date().toISOString())).toEqual([]);
  expect(
    CompanyNewsInputSchema.safeParse({
      ...input,
      copiedText: 'Unlicensed article',
      copiedFrom: 0,
    }).success,
  ).toBe(false);
  expect(
    companyNewsReasons(
      {
        ...input,
        citations: input.citations.map((row) => ({
          ...row,
          originator: 'same issuer',
        })),
      },
      new Date().toISOString(),
    ),
  ).toContain(
    'Two independent originators are required; syndication and mirrored filings count once.',
  );
  expect(
    companyNewsReasons(
      { ...input, conflicts: 'unresolved' },
      new Date().toISOString(),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    companyNewsReasons(input, new Date(Date.now() + 8 * 86400000).toISOString())
      .length,
  ).toBeGreaterThan(0);
});

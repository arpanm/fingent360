import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1113 local public story view is retained without operator or provider calls @EVAL-LINEAGE-001', async ({
  page,
}) => {
  const forbidden: string[] = [];
  page.on('request', (r) => {
    if (
      /\/ops\/evaluations|api.openai.com|generativelanguage.googleapis.com/.test(
        r.url(),
      )
    )
      forbidden.push(r.url());
  });
  await page.goto('/#today');
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Reading story' }),
  ).toBeVisible();
  const value = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem('fingent360-public-reading-view-v1') ?? 'null',
    ),
  );
  expect(value.kind).toBe('story');
  expect(value.item.status).toBe('published');
  expect(forbidden).toEqual([]);
});
test('E2E-OFFLINE-1117 local history consent persists while remote transcripts remain absent @EVAL-LINEAGE-001', async ({
  page,
}) => {
  const { prepareConnectionBrowser } =
    await import('../../helpers/research-connection-fixture');
  const { consentInput, consentCall } =
    await import('../../helpers/consent-fixture');
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  expect(
    (
      await consentCall(
        page,
        '/api/v1/account/consents/private-ai-history',
        'POST',
        consentInput('grant', 0),
      )
    ).status,
  ).toBe(201);
  const first = await consentCall(page, '/api/v1/account/ai-history');
  expect(first.body).toEqual({ enabled: true, entries: [], retentionDays: 7 });
  await page.reload();
  expect((await consentCall(page, '/api/v1/account/ai-history')).body).toEqual(
    first.body,
  );
});

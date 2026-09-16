import {
  test,
  expect,
  prepareCompanyNews,
  reviewNews,
  retentionHeaders,
} from '../../helpers/company-news';
test.use({ namedOperators: true });
test('E2E-WEB-1300 reviewed company report reader exposes both real retained citations and company navigation @SRC-012 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { id, reviewer } = await prepareCompanyNews(
    request,
    playwright,
    feedbackSandbox,
  );
  expect(
    (
      await reviewer.post('/api/v1/ops/company-news/review', {
        headers: retentionHeaders,
        data: reviewNews(id),
      })
    ).status(),
  ).toBe(201);
  await page.goto(`/#read/${id}`);
  const proof = page.getByRole('region', { name: 'Company news verification' });
  await expect(proof).toBeVisible();
  await expect(
    proof.getByRole('link', { name: 'Synthetic issuer' }),
  ).toHaveAttribute('href', 'https://example.com/issuer');
  await expect(
    proof.getByRole('link', { name: 'Synthetic independent' }),
  ).toBeVisible();
  await expect(
    proof.getByRole('link', { name: /company evidence/ }),
  ).toHaveAttribute('href', /equity=INE002A01018/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reviewer.dispose();
});

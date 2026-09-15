import { expect, type Page } from '@playwright/test';
export async function inspectBrokerGuidance(page: Page) {
  await page
    .getByText('Broker export help and supported imports', { exact: true })
    .click();
  for (const [id, name] of [
    ['zerodha', 'Zerodha'],
    ['groww', 'Groww'],
    ['upstox', 'Upstox'],
    ['angel-one', 'Angel One'],
    ['icici-direct', 'ICICI Direct'],
  ]) {
    await page.getByLabel('Your broker', { exact: true }).selectOption(id!);
    const guide = page.getByRole('region', {
      name: `${name} import guidance`,
      exact: true,
    });
    await expect(guide.getByRole('status')).toHaveText(
      `Automatic ${name} format is not enabled.`,
    );
    await guide
      .getByText('Why does this need a review?', { exact: true })
      .click();
    await expect(guide).toContainText(
      'Selecting a broker does not verify your file',
    );
    await expect(
      guide.getByRole('link', {
        name: `${name} official export help (opens a new tab)`,
        exact: true,
      }),
    ).toHaveAttribute('href', /^https:\/\//);
  }
  await page
    .getByRole('button', {
      name: 'Continue with reviewed CSV mapping',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Map CSV columns', exact: true }),
  ).toBeVisible();
}

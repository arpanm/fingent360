import { test, expect } from '../../helpers/app-fixture';
test.use({ manualWorkers: true });
test('E2E-WEB-1350 actual initial global source coverage links reader rates and source boundaries @SRC-008', async ({
  page,
}) => {
  await page.goto('/#global-macro');
  const panel = page.getByRole('main', { name: 'Global macro coverage' });
  await expect(
    panel.getByRole('heading', { name: 'Global context, with clear coverage' }),
  ).toBeVisible();
  await expect(
    panel.getByRole('region', { name: 'ECB numerical policy rates' }),
  ).toContainText('Published edition');
  await expect(
    panel.getByRole('region', { name: 'BLS release calendar' }),
  ).toContainText('events in selected retained capture');
  await panel
    .getByRole('link', { name: 'Open policy rates and evidence' })
    .click();
  await expect(page).toHaveURL(/#policy-rates$/);
  await page.goBack();
  await expect(panel).toContainText(
    'FRED and Treasury numerical adapters are not enabled',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel
    .getByRole('link', { name: 'Back to More', exact: true })
    .press('Enter');
  await expect(page).toHaveURL(/#more$/);
});

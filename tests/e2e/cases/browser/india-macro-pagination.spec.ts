import { test, expect, indiaActors } from '../../helpers/india-gdp';
import { seedIndiaMacroPages } from '../../helpers/india-macro-pagination';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1810 India source queue and quarantine reach oldest records and refresh resets continuation @SRC-007 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await seedIndiaMacroPages(request, feedbackSandbox);
    await sourceOpsBrowser(page, request, feedbackSandbox, 'India macro');
    const panel = page.getByRole('region', { name: 'India macro onboarding' });
    await expect(
      panel.getByRole('button', {
        name: 'Publish independently checked edition',
      }),
    ).toHaveCount(25);
    for (let index = 0; index < 4; index++) {
      await panel
        .getByRole('button', { name: 'Load older India editions' })
        .click();
      await expect(
        panel.getByRole('button', {
          name: 'Publish independently checked edition',
        }),
      ).toHaveCount(Math.min(101, 50 + index * 25));
    }
    await expect(
      panel.getByRole('button', { name: 'Load older India editions' }),
    ).toHaveCount(0);
    for (let index = 0; index < 4; index++) {
      await panel
        .getByRole('button', { name: 'Load older quarantined sources' })
        .click();
      await expect(
        panel.getByRole('button', { name: 'Download retained attempt' }),
      ).toHaveCount(Math.min(101, 50 + index * 25));
    }
    await panel.getByRole('button', { name: 'Refresh India queue' }).click();
    await expect(
      panel.getByRole('button', { name: 'Download retained attempt' }),
    ).toHaveCount(25);
    await expect(
      panel.getByRole('button', {
        name: 'Publish independently checked edition',
      }),
    ).toHaveCount(25);
  } finally {
    await reviewer.dispose();
  }
});

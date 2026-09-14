import { test, expect, eventFixture } from '../../helpers/event-fixture';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-700 author actual source event then read reviewed context with Back @EVENT-REVIEW-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const fixture = await eventFixture(request, feedbackSandbox);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Event review', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Event editorial review' });
  await panel
    .getByRole('button', { name: 'Create event draft', exact: true })
    .click();
  await panel
    .getByLabel('Event title', { exact: true })
    .fill('Synthetic browser event context');
  await panel
    .getByLabel('Event family', { exact: true })
    .fill('Synthetic policy family');
  await panel
    .getByLabel('Claim kind', { exact: true })
    .selectOption('inference');
  await panel
    .getByLabel('Editorial explanation', { exact: true })
    .fill('Synthetic explicit context anchored to the actual stored source.');
  await panel
    .getByRole('button', { name: 'Add source excerpt', exact: true })
    .click();
  await expect(
    panel.getByLabel('Exact excerpt 1', { exact: true }),
  ).toHaveValue(fixture.source.title);
  await panel
    .getByLabel('Draft revision reason', { exact: true })
    .fill('Synthetic first editorial record');
  await panel
    .getByRole('button', { name: 'Save event draft', exact: true })
    .click();
  await expect(panel.getByRole('status')).toHaveText(
    'Event draft saved. Public state is unchanged.',
  );
  await panel
    .getByLabel('Event review note', { exact: true })
    .fill('Synthetic source reviewed for publication');
  await panel
    .getByRole('button', { name: 'Review event publication', exact: true })
    .click();
  await expect(panel.getByRole('status')).toContainText(
    'Saved historical event review receipt',
  );
  await panel
    .getByRole('button', { name: 'Close event editor', exact: true })
    .click();
  await panel
    .getByRole('link', { name: 'Read public event', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic browser event context',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Reviewed events' }),
  ).toContainText(fixture.source.title);
  await expect(
    page.getByText('Price direction, causal effect and financial action:', {
      exact: false,
    }),
  ).toBeVisible();
  const evidence = page.getByText('Exact evidence reference', { exact: true });
  await evidence.focus();
  await evidence.press('Enter');
  await expect(
    page.getByText(`Evidence reference: ${fixture.source.sourceHash}`, {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to events', exact: true }).click();
  await expect(
    page.getByRole('link', {
      name: 'Synthetic browser event context',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('E2E-WEB-701 excerpt removal and choice refresh preserve editor drafts and navigation cancellation @EVENT-REVIEW-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  await eventFixture(request, feedbackSandbox);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Event review', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Event editorial review' });
  await panel
    .getByRole('button', { name: 'Create event draft', exact: true })
    .click();
  await panel
    .getByLabel('Event title', { exact: true })
    .fill('Synthetic preserved event draft');
  await panel
    .getByRole('button', { name: 'Add source excerpt', exact: true })
    .click();
  await panel
    .getByRole('button', { name: 'Add source excerpt', exact: true })
    .click();
  await panel
    .getByRole('button', { name: 'Remove source excerpt 1', exact: true })
    .click();
  await expect(
    panel.getByLabel('Exact excerpt 1', { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByLabel('Exact excerpt 2', { exact: true }),
  ).toHaveCount(0);
  await panel
    .getByRole('button', {
      name: 'Refresh available sources and identities',
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole('button', {
      name: 'Refresh available sources and identities',
      exact: true,
    }),
  ).toBeEnabled();
  await expect(panel.getByLabel('Event title', { exact: true })).toHaveValue(
    'Synthetic preserved event draft',
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Publishing', exact: true }).click();
  await expect(panel.getByLabel('Event title', { exact: true })).toHaveValue(
    'Synthetic preserved event draft',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await panel
    .getByRole('button', { name: 'Close event editor', exact: true })
    .click();
  await expect(panel.getByLabel('Event title', { exact: true })).toHaveCount(0);
});

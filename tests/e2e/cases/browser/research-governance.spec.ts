import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  governanceFixture,
  governanceHeaders,
} from '../../helpers/research-governance';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-WEB-1290 source-bound policy opens simulation independent release and immutable history @DEV-015 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await request.post(
          `/api/v1/ops/research-governance/${fixture.id}/simulations`,
          {
            headers: governanceHeaders,
            data: { requestId: randomUUID(), expectedVersion: 1 },
          },
        )
      ).status(),
    ).toBe(201);
    await page.goto('/#ops');
    await page
      .getByLabel('Named operator username', { exact: true })
      .fill(fixture.credentials.username);
    await page
      .getByLabel('Named operator password', { exact: true })
      .fill(fixture.credentials.password);
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await page
      .getByRole('button', {
        name: 'Research policies and causal review',
        exact: true,
      })
      .click();
    const panel = page.getByRole('region', {
      name: 'Research governance',
      exact: true,
    });
    // No selected revision or event exists on the initial render.
    await expect(panel).toBeVisible();
    await expect(
      panel.getByLabel('Reviewed event', { exact: true }),
    ).toHaveValue('');
    await expect(
      panel.getByRole('button', { name: 'Save research draft', exact: true }),
    ).toBeDisabled();
    await panel
      .getByRole('button', { name: fixture.input.title, exact: true })
      .click();
    await expect(
      panel.getByLabel('Maximum concentration (basis points)', { exact: true }),
    ).toHaveValue('5000');
    await expect(
      panel.getByRole('link', {
        name: 'Inspect reviewed event and sources',
        exact: true,
      }),
    ).toHaveAttribute('href', '#events/' + fixture.eventId);
    await expect(panel.getByText(/Simulation passed/)).toBeVisible();
    await panel
      .getByLabel('Independent review reason', { exact: true })
      .fill(
        'Independent UI review of exact source-bound deterministic limits.',
      );
    await panel
      .getByRole('button', { name: 'Release research version', exact: true })
      .click();
    await expect(
      panel.getByText('Research version released.', { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'Open governance history', exact: true })
      .click();
    await expect(
      panel.getByText(/Version 1 · release · Independent UI review/),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole('button', {
        name: 'Research policies and causal review',
        exact: true,
      })
      .click();
    await panel
      .getByRole('button', { name: fixture.input.title, exact: true })
      .click();
    await panel
      .getByLabel('Independent review reason', { exact: true })
      .fill('Withdraw the synthetic limits after the persisted release.');
    await panel
      .getByRole('button', { name: 'Withdraw research version', exact: true })
      .click();
    await expect(
      panel.getByText('Research version withdrawn.', { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'New research draft', exact: true })
      .click();
    await expect(
      panel.getByLabel('Reviewed event', { exact: true }),
    ).toHaveValue('');
    await expect(
      panel.getByRole('button', { name: 'Save research draft', exact: true }),
    ).toBeDisabled();
  } finally {
    await fixture.reviewer.dispose();
  }
});

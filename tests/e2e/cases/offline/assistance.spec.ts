import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('E2E-OFFLINE-150 query help applies only chosen names and uses local history only when selected @ASSIST-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith('/api/') ||
      url.origin !== new URL(page.url()).origin
    )
      network.push(url.origin + url.pathname);
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  // Start observation after packaged assets load; all assistance transport below
  // must remain in the actual on-device API and storage implementation.
  network.length = 0;
  await page.evaluate(
    async (username) => {
      async function post(path: string, body: unknown) {
        const response = await fetch('/api/v1/account/' + path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok)
          throw Error(`Local fixture ${path}: ${response.status}`);
      }
      await post('register', {
        username,
        password: 'Synthetic-assistance-2026',
        consent: true,
      });
      await post('goals', {
        name: 'Synthetic mango reserve',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '0',
        monthlyMinor: '100',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
    },
    `assist_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#my-goals');
  await page
    .getByRole('button', { name: 'Create a goal', exact: true })
    .click();
  await page.getByText('Help me with this', { exact: true }).click();
  const query = page.getByLabel('What would you like help with?', {
    exact: true,
  });
  const ask = page.getByRole('button', {
    name: 'Get suggestions',
    exact: true,
  });
  const results = page.getByRole('region', { name: 'Assistance results' });
  const name = page.getByLabel('Goal name', { exact: true });
  await expect(
    page.getByLabel('Assistance provider', { exact: true }),
  ).toHaveValue('query');
  await expect(
    page.getByText(
      'Your question is matched on this device. No cloud AI request is made.',
      { exact: true },
    ),
  ).toBeVisible();
  await query.fill('education goal');
  await ask.click();
  await expect(results).toContainText('No cloud AI request was made.');
  await expect(name).toHaveValue('');
  await results
    .getByRole('button', { name: 'Apply name suggestion', exact: true })
    .click();
  await expect(name).toHaveValue('Education goal');
  await results
    .getByRole('button', { name: 'Dismiss assistance results', exact: true })
    .click();
  await expect(results).toHaveCount(0);
  await expect(name).toHaveValue('Education goal');

  await query.fill('mango');
  await ask.click();
  await expect(results).toContainText('No matching suggestions.');
  const history = page.getByRole('checkbox', {
    name: /Use my saved goal names/,
  });
  await history.check();
  await ask.click();
  await expect(results).toContainText('Synthetic mango reserve');
  await expect(results).toContainText('Saved history used');
  await expect(name).toHaveValue('Education goal');
  await results
    .getByRole('button', { name: 'Apply name suggestion', exact: true })
    .click();
  await expect(name).toHaveValue('Synthetic mango reserve');
  await history.uncheck();
  await ask.click();
  await expect(results).toContainText('No saved history used');
  await expect(results).not.toContainText('Synthetic mango reserve');

  // Applying to a draft is not a save and must not mutate the existing record.
  // Goals installs a beforeunload guard for the applied, unsaved name. Explicitly
  // discard it here; Playwright's default dialog dismissal can cancel reload.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Create a goal', exact: true }),
  ).toBeVisible();
  const goals = await page.evaluate(async () => {
    const response = await fetch('/api/v1/account/goals');
    if (!response.ok) throw Error('Cannot inspect saved local goals.');
    return response.json() as Promise<{ goals: { name: string }[] }>;
  });
  expect(goals.goals.map((goal) => goal.name)).toEqual([
    'Synthetic mango reserve',
  ]);
  expect(network).toEqual([]);
});

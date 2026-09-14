import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
import { PublicationProposalSchema } from '../../../../packages/contracts/src/index';

test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };

test('E2E-WEB-640 named independent review recovers a lost committed approval receipt @NAMED-OPERATORS-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: 'publisher_' + randomUUID().slice(0, 8),
    password: 'Synthetic-publisher-password-2026',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const proposalId = randomUUID();
  expect(
    (
      await request.put('/api/v1/ops/proposals/' + proposalId, {
        headers,
        data: {
          kind: 'discovery',
          target: source.id,
          body: {
            expectedVersion: source.version,
            status: 'withdrawn',
            correctionNote: 'Synthetic independent publication review',
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/#ops');
  await page
    .getByLabel('Named operator username', { exact: true })
    .fill(credentials.username);
  await page
    .getByLabel('Named operator password', { exact: true })
    .fill(credentials.password);
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Named operators and proposals', exact: true })
    .click();
  await page
    .getByRole('button', { name: new RegExp('discovery.*' + source.id) })
    .click();
  await page
    .getByRole('button', { name: 'Inspect bound target', exact: true })
    .click();
  await expect(
    page.getByText('Protected target read for this proposal.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Publication target inspection' }),
  ).toContainText(source.title);
  await page
    .getByLabel('Decision note', { exact: true })
    .fill('Synthetic independent reviewer approves');
  let committed: unknown;
  const path = '**/api/v1/ops/proposals/' + proposalId + '/approve';
  await page.route(
    path,
    async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname,
      });
      expect(response.status()).toBe(201);
      committed = PublicationProposalSchema.parse(await response.json());
      await route.abort();
    },
    { times: 1 },
  );
  await page
    .getByRole('button', { name: 'Approve exact publication', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page
    .getByRole('button', { name: 'Approve exact publication', exact: true })
    .click();
  await expect(
    page.getByText('Saved approved receipt.', { exact: false }),
  ).toBeVisible();
  const receipt = PublicationProposalSchema.parse(
    await (await request.get('/api/v1/ops/proposals/' + proposalId)).json(),
  );
  expect(receipt).toEqual(committed);
  await expect(
    page.getByRole('button', {
      name: 'Approve exact publication',
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Close proposal', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Reload proposals and operators',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: new RegExp('discovery.*' + source.id + '.*approved'),
    }),
  ).toBeVisible();
});

test('E2E-WEB-641 named administrator creates a viewer and independent review remains required @NAMED-OPERATORS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await page.goto('/#ops');
  await page
    .getByLabel('Named operator username', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.username);
  await page
    .getByLabel('Named operator password', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.password);
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Named operators and proposals', exact: true })
    .click();
  const username = 'viewer_' + randomUUID().slice(0, 8);
  await page
    .getByLabel('New operator username', { exact: true })
    .fill(username);
  await page
    .getByLabel('New operator password', { exact: true })
    .fill('Synthetic-viewer-password-2026');
  await page
    .getByLabel('New operator role', { exact: true })
    .selectOption('viewer');
  await page
    .getByRole('button', { name: 'Create named operator', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: username, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('New operator password', { exact: true }),
  ).toHaveValue('');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Disable ' + username, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enable ' + username, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Named operators and proposals', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enable ' + username, exact: true }),
  ).toBeVisible();
});

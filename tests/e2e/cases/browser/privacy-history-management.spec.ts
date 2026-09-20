import { readFile } from 'node:fs/promises';
import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
import {
  consentCard,
  consentView,
  consentWrite,
} from '../../helpers/consent-fixture';
import {
  privacyActivate,
  retainSyntheticPrivacyHistory,
} from '../../helpers/privacy-management';
import { captureObservationLayout } from '../../helpers/observation-inbox-accessibility';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { PrivateAiHistorySchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

async function consentByKeyboard(
  page: import('@playwright/test').Page,
  action: 'grant' | 'revocation',
) {
  await privacyActivate(
    page,
    consentCard(page, 'private-ai-history').getByRole('button', {
      name: `Review ${action}`,
      exact: true,
    }),
  );
  await privacyActivate(
    page,
    page.getByRole('button', { name: 'Review decision', exact: true }),
  );
  await privacyActivate(
    page,
    page.getByLabel(
      'I reviewed this purpose, the data used and this decision',
      { exact: true },
    ),
    'Space',
  );
  await privacyActivate(
    page,
    page.getByRole('button', { name: 'Save consent decision', exact: true }),
  );
  await expect(
    page.getByRole('region', { name: 'Saved consent receipt', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Refresh current permissions',
      exact: true,
    }),
  ).toBeEnabled();
}

test('E2E-WEB-1405 private history keyboard consent load export delete and revoke retain dated snapshots during recoverable transport errors @DEV-017 @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  const owner = await registerRecoverable(request);
  const pool = await connectionDatabase(feedbackSandbox);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 360, height: 780 });
  let failNext: string | null = null;
  await page.route('**/api/v1/account/ai-history', (route) => {
    if (failNext === route.request().method()) {
      failNext = null;
      return route.abort('failed');
    }
    return route.fallback();
  });
  try {
    await page.goto('/#privacy');
    const history = page.getByRole('region', {
      name: 'My AI request history',
      exact: true,
    });
    const load = history.getByRole('button', {
      name: 'Load my AI history',
      exact: true,
    });
    await privacyActivate(page, load);
    await expect(history).toContainText('History not enabled');
    await consentByKeyboard(page, 'grant');
    const permissions = await consentView(request);
    expect(
      permissions.purposes.find(
        (item) => item.record.purpose === 'external-ai-private-context',
      )?.record.decision,
    ).toBe('not-granted');
    const id = await retainSyntheticPrivacyHistory(feedbackSandbox, owner.id);
    await privacyActivate(page, load);
    await expect(history).toContainText('1 retained requests');
    await privacyActivate(page, history.locator('summary'), 'Space');
    await expect(history.locator('pre')).toContainText(
      'Synthetic private history keyboard question',
    );
    await expect(history.locator('pre')).toContainText(
      'Synthetic private history answer',
    );
    failNext = 'GET';
    await privacyActivate(page, load);
    await expect(history.getByRole('alert')).toBeVisible();
    await expect(history).toContainText(
      'Showing the last successful snapshot.',
    );
    await expect(history).toContainText('Last loaded');
    await expect(history.locator('pre')).toContainText(
      'Synthetic private history answer',
    );
    await privacyActivate(page, load);
    await expect(history.getByRole('alert')).toHaveCount(0);
    const download = history.getByRole('button', {
      name: 'Download my AI history',
      exact: true,
    });
    failNext = 'GET';
    await privacyActivate(page, download);
    await expect(history.getByRole('alert')).toBeVisible();
    await expect(history).toContainText('1 retained requests');
    const downloaded = page.waitForEvent('download');
    await privacyActivate(page, download);
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('my-ai-history.json');
    const path = await file.path();
    if (!path) throw Error('Synthetic history download was not retained.');
    const exported = PrivateAiHistorySchema.parse(
      JSON.parse(await readFile(path, 'utf8')),
    );
    expect(exported.entries).toHaveLength(1);
    expect(exported.entries[0]?.id).toBe(id);
    await expect(history.getByRole('alert')).toHaveCount(0);
    const remove = history.getByRole('button', {
      name: 'Delete my AI history',
      exact: true,
    });
    failNext = 'DELETE';
    await privacyActivate(page, remove);
    await expect(history.getByRole('alert')).toBeVisible();
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].n,
    ).toBe(1);
    await privacyActivate(page, remove, 'Space');
    await expect(history).toContainText('Saved request history deleted.');
    await expect(history).toContainText('0 retained requests');
    await expect(remove).toBeDisabled();
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].n,
    ).toBe(0);
    await retainSyntheticPrivacyHistory(feedbackSandbox, owner.id);
    await privacyActivate(page, load);
    await expect(history).toContainText('1 retained requests');
    await consentByKeyboard(page, 'revocation');
    await privacyActivate(page, load);
    await expect(history).toContainText('History not enabled');
    await expect(history).toContainText('0 retained requests');
    await expect(history.locator('pre')).toHaveCount(0);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].n,
    ).toBe(0);
    await captureObservationLayout(
      page,
      history,
      testInfo,
      'synthetic-history-revoked.png',
    );
    await page.reload();
    await privacyActivate(page, load);
    await expect(history).toContainText('History not enabled');
  } finally {
    await page.unroute('**/api/v1/account/ai-history');
    await pool.end();
  }
});

test('E2E-WEB-1406 actual history authentication denial clears decrypted content and stale controls before privacy reload @DEV-017 @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  await retainSyntheticPrivacyHistory(feedbackSandbox, owner.id);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/#privacy');
  const history = page.getByRole('region', {
    name: 'My AI request history',
    exact: true,
  });
  const load = history.getByRole('button', {
    name: 'Load my AI history',
    exact: true,
  });
  await privacyActivate(page, load);
  await privacyActivate(page, history.locator('summary'));
  await expect(history.locator('pre')).toContainText(
    'Synthetic private history answer',
  );
  expect(
    (
      await request.post('/api/v1/account/logout', { headers: authHeaders })
    ).status(),
  ).toBe(200);
  const denied = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/account/ai-history' &&
      response.status() === 401,
  );
  await privacyActivate(page, load);
  await denied;
  await expect(history.getByRole('alert')).toContainText('Please sign in');
  await expect(history.locator('pre, details')).toHaveCount(0);
  await expect(history).not.toContainText('Synthetic private history answer');
  await expect(history).not.toContainText('Last loaded');
  await expect(
    history.getByRole('button', { name: 'Download my AI history' }),
  ).toHaveCount(0);
  await expect(load).toBeDisabled();
  await privacyActivate(
    page,
    history.getByRole('button', { name: 'Reload privacy page', exact: true }),
  );
  await expect(
    page.getByRole('heading', { name: 'Manage your information', exact: true }),
  ).toBeVisible();
  await expect(history).toHaveCount(0);
});

test('E2E-WEB-1407 a held real private export response cannot download or restore history after leaving privacy @DEV-017 @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  await retainSyntheticPrivacyHistory(feedbackSandbox, owner.id);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#privacy');
  const history = page.getByRole('region', {
    name: 'My AI request history',
    exact: true,
  });
  await privacyActivate(
    page,
    history.getByRole('button', { name: 'Load my AI history', exact: true }),
  );
  await expect(history).toContainText('1 retained requests');
  let release!: () => void;
  let captured!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const received = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let downloads = 0;
  page.on('download', () => {
    downloads++;
  });
  const pattern = '**/api/v1/account/ai-history';
  await page.route(pattern, async (route) => {
    const response = await route.fetch({
      url: feedbackSandbox.apiOrigin + '/api/v1/account/ai-history',
      headers: { ...(await route.request().allHeaders()), ...authHeaders },
    });
    expect(response.status()).toBe(200);
    expect(
      PrivateAiHistorySchema.parse(await response.json()).entries,
    ).toHaveLength(1);
    captured();
    await held;
    await route.fulfill({ response });
  });
  try {
    await privacyActivate(
      page,
      history.getByRole('button', {
        name: 'Download my AI history',
        exact: true,
      }),
    );
    await received;
    await page.goto('/#today');
    await expect(history).toHaveCount(0);
    const finished = page.waitForEvent('requestfinished', {
      predicate: (sent) =>
        new URL(sent.url()).pathname === '/api/v1/account/ai-history',
    });
    release();
    await finished;
    await page.unroute(pattern);
    await page.goto('/#privacy');
    await expect(
      history.getByRole('button', { name: 'Load my AI history', exact: true }),
    ).toBeEnabled();
    await expect(history.locator('pre, details')).toHaveCount(0);
    await expect(
      history.getByRole('button', { name: 'Download my AI history' }),
    ).toHaveCount(0);
    expect(downloads).toBe(0);
  } finally {
    release();
    await page.unroute(pattern);
  }
});

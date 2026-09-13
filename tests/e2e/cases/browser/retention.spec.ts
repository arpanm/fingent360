import type { Page } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  ownedRetentionDatabase,
  seedRetentionRows,
} from '../../helpers/retention';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function signIn(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Expired data cleanup', exact: true }),
  ).toBeVisible();
}

test('E2E-WEB-250 operator cleanup loading preview cancel keyboard confirm result history and mobile layout @RETENTION-001', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(90000);
  await signIn(page);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  let releaseHistory = () => {};
  const heldHistory = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  try {
    const fixture = await seedRetentionRows(request, pool);
    let hold = true;
    await page.route(/\/api\/v1\/ops\/retention\/runs$/, async (route) => {
      if (hold) await heldHistory;
      await route.fallback();
    });
    await page
      .getByRole('button', { name: 'Expired data cleanup', exact: true })
      .click();
    const region = page.getByRole('region', {
      name: 'Expired data cleanup',
      exact: true,
    });
    await expect(
      region.getByText('Loading cleanup history…', { exact: true }),
    ).toBeVisible();
    await expect(
      region.getByRole('button', { name: 'Preview expired records' }),
    ).toBeDisabled();
    hold = false;
    releaseHistory();
    await expect(
      region.getByText('No cleanup previews have been saved.', { exact: true }),
    ).toBeVisible();
    await region
      .getByRole('button', { name: 'Preview expired records', exact: true })
      .click();
    const selected = region.getByRole('article', {
      name: 'Selected cleanup record',
    });
    await expect(
      selected.getByRole('heading', {
        name: 'Saved cleanup preview',
        exact: true,
      }),
    ).toBeFocused();
    await expect(
      selected
        .getByRole('list', { name: 'Cleanup preview counts' })
        .getByRole('listitem'),
    ).toHaveCount(8);
    const review = selected.getByRole('button', {
      name: 'Review cleanup',
      exact: true,
    });
    await review.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {
      name: 'Clean up expired records?',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    // Counts and fixed policy only; capture after the credential form is gone.
    await page.screenshot({
      path: testInfo.outputPath('cleanup-confirmation.png'),
      fullPage: false,
    });
    await expect(dialog).toContainText(
      'Financial records and feedback deletion receipts remain.',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(review).toBeFocused();
    await expect(
      region.getByText(
        'Cleanup cancelled. The saved preview is still available.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(1);
    await review.press('Enter');
    await dialog
      .getByRole('button', { name: 'Cancel cleanup', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await review.press('Enter');
    const confirm = dialog.getByRole('button', {
      name: 'Confirm cleanup',
      exact: true,
    });
    await confirm.focus();
    await page.keyboard.press('Enter');
    await expect(
      selected.getByRole('heading', { name: 'Cleanup complete', exact: true }),
    ).toBeFocused();
    await expect(
      selected.getByRole('list', { name: 'Cleanup result counts' }),
    ).toContainText('1 cleaned');
    await expect(
      selected.getByRole('button', { name: 'Review cleanup', exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await pool.query('SELECT 1 FROM app_sessions WHERE token_hash=$1', [
          fixture.expired,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.reload();
    await page
      .getByRole('button', { name: 'Expired data cleanup', exact: true })
      .click();
    await region.getByRole('button', { name: /^Open cleanup record / }).click();
    await expect(
      selected.getByRole('heading', { name: 'Cleanup complete', exact: true }),
    ).toBeVisible();
    await selected
      .getByRole('button', { name: 'Check saved cleanup result' })
      .click();
    expect(
      (
        await pool.query(
          "SELECT 1 FROM operator_audit WHERE action='retention-completed'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    releaseHistory();
    await pool.end();
  }
});

test('E2E-WEB-251 unavailable history retries real storage and empty preview offers no unnecessary cleanup @RETENTION-001', async ({
  page,
}) => {
  await signIn(page);
  let unavailable = true;
  await page.route(/\/api\/v1\/ops\/retention\/runs$/, async (route) => {
    if (unavailable) await route.abort('failed');
    else await route.fallback();
  });
  await page
    .getByRole('button', { name: 'Expired data cleanup', exact: true })
    .click();
  const region = page.getByRole('region', {
    name: 'Expired data cleanup',
    exact: true,
  });
  await expect(region.getByRole('alert')).toContainText(
    'Cleanup history could not load.',
  );
  unavailable = false;
  await region
    .getByRole('button', { name: 'Reload cleanup history', exact: true })
    .click();
  await expect(
    region.getByText('No cleanup previews have been saved.', { exact: true }),
  ).toBeVisible();
  await region
    .getByRole('button', { name: 'Preview expired records', exact: true })
    .click();
  await expect(
    region.getByText(
      'No expired records at this cutoff. No cleanup is needed.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    region.getByRole('button', { name: 'Review cleanup', exact: true }),
  ).toHaveCount(0);
  await expect(region.getByRole('alert')).toHaveCount(0);
});

test('E2E-WEB-252 lost preview and cleanup responses reopen the actual committed record without duplicate execution @RETENTION-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  await signIn(page);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    await seedRetentionRows(request, pool);
    let losePreview = true,
      loseExecution = true;
    await page.route(
      /\/api\/v1\/ops\/retention\/(?:previews|runs\/[^/]+\/execute)$/,
      async (route) => {
        const url = new URL(route.request().url());
        const preview = url.pathname.endsWith('/previews');
        if (preview ? losePreview : loseExecution) {
          if (preview) losePreview = false;
          else loseExecution = false;
          // Commit against this test's actual owned API, then drop only delivery.
          // Never route.fetch the shared web application's unrewritten URL.
          const response = await route.fetch({
            url: `${feedbackSandbox.apiOrigin}${url.pathname}`,
          });
          expect(response.status()).toBe(201);
          await route.abort('failed');
        } else await route.fallback();
      },
    );
    await page
      .getByRole('button', { name: 'Expired data cleanup', exact: true })
      .click();
    const region = page.getByRole('region', {
      name: 'Expired data cleanup',
      exact: true,
    });
    await region
      .getByRole('button', { name: 'Preview expired records', exact: true })
      .click();
    await expect(region.getByRole('alert')).toBeVisible();
    await region
      .getByRole('button', { name: 'Retry preview request', exact: true })
      .click();
    await expect(
      region.getByRole('heading', {
        name: 'Saved cleanup preview',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await pool.query('SELECT 1 FROM retention_runs')).rows,
    ).toHaveLength(1);
    await region
      .getByRole('button', { name: 'Review cleanup', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm cleanup', exact: true })
      .click();
    await expect(region.getByRole('alert')).toBeVisible();
    await region
      .getByRole('button', { name: 'Check saved cleanup result', exact: true })
      .click();
    await expect(
      region.getByRole('heading', { name: 'Cleanup complete', exact: true }),
    ).toBeVisible();
    expect(
      (
        await pool.query(
          "SELECT 1 FROM operator_audit WHERE action='retention-completed'",
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await pool.end();
  }
});

test('E2E-WEB-253 failed batch explains rollback and keyboard retry finishes the same saved preview @RETENTION-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  await signIn(page);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    await seedRetentionRows(request, pool);
    await pool.query(
      "CREATE FUNCTION fixture_retention_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic fixture failure'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER fixture_retention_failure BEFORE DELETE ON app_recovery_limits FOR EACH ROW EXECUTE FUNCTION fixture_retention_failure()',
    );
    await page
      .getByRole('button', { name: 'Expired data cleanup', exact: true })
      .click();
    const region = page.getByRole('region', {
      name: 'Expired data cleanup',
      exact: true,
    });
    await region
      .getByRole('button', { name: 'Preview expired records', exact: true })
      .click();
    await region
      .getByRole('button', { name: 'Review cleanup', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm cleanup', exact: true })
      .click();
    await expect(
      region.getByRole('heading', { name: 'Cleanup rolled back', exact: true }),
    ).toBeFocused();
    await expect(region.getByRole('alert')).toContainText(
      'No category was partially cleaned.',
    );
    await pool.query(
      'DROP TRIGGER fixture_retention_failure ON app_recovery_limits',
    );
    await region
      .getByRole('button', { name: 'Review cleanup retry', exact: true })
      .press('Enter');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm cleanup', exact: true })
      .press('Enter');
    await expect(
      region.getByRole('heading', { name: 'Cleanup complete', exact: true }),
    ).toBeFocused();
    await expect(
      region.getByRole('article', { name: 'Selected cleanup record' }),
    ).toContainText('Attempts 2');
  } finally {
    await pool.end();
  }
});

test('E2E-WEB-254 expired operator session returns to sign-in and reopens the preserved cleanup preview @RETENTION-001', async ({
  page,
  feedbackSandbox,
}) => {
  await signIn(page);
  const pool = await ownedRetentionDatabase(feedbackSandbox);
  try {
    await page
      .getByRole('button', { name: 'Expired data cleanup', exact: true })
      .click();
    const region = page.getByRole('region', {
      name: 'Expired data cleanup',
      exact: true,
    });
    await region
      .getByRole('button', { name: 'Preview expired records', exact: true })
      .click();
    await expect(
      region.getByRole('heading', {
        name: 'Saved cleanup preview',
        exact: true,
      }),
    ).toBeVisible();
    await pool.query(
      "UPDATE operator_sessions SET expires_at=now()-interval '1 day'",
    );
    await region
      .getByRole('button', { name: 'Check saved cleanup result', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Operations sign-in', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(
      'Sign in again to reopen saved cleanup history.',
    );
    await page
      .getByLabel('Operator key', { exact: true })
      .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await region.getByRole('button', { name: /^Open cleanup record / }).click();
    await expect(
      region.getByRole('heading', {
        name: 'Saved cleanup preview',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await pool.query(
          "SELECT 1 FROM operator_audit WHERE action='retention-completed'",
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await pool.end();
  }
});

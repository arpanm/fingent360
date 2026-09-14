import { readFile } from 'node:fs/promises';
import { test, expect } from '../../helpers/app-fixture';
import {
  ConsentReceiptSchema,
  CompletePrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import {
  connectionDatabase,
  prepareConnectionBrowser,
} from '../../helpers/research-connection-fixture';
import {
  consentPath,
  externalPurpose,
  readingPurpose,
  consentInput,
  consentCall as call,
  consentRegion,
  consentCard,
  saveConsentUI,
  trackedConsentRoutes,
} from '../../helpers/consent-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function open(page: Parameters<typeof prepareConnectionBrowser>[0]) {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  await page.goto('/#privacy');
  await expect(consentCard(page, externalPurpose)).toContainText('not granted');
}
test('E2E-WEB-760 keyboard mobile review cancel grant expiry renewal revocation history and Back @CONSENT-LIFECYCLE-001', async ({
  page,
}, testInfo) => {
  await open(page);
  await consentCard(page, externalPurpose)
    .getByRole('button', { name: 'Review grant', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: /Review grant: Private context/ }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Cancel consent review', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Purpose consent', exact: true }),
  ).toBeFocused();
  await saveConsentUI(page, externalPurpose);
  await expect(consentCard(page, externalPurpose)).toContainText(
    'Current status: active',
  );
  await consentCard(page, externalPurpose)
    .getByRole('button', { name: 'Review renewal', exact: true })
    .click();
  await page
    .getByLabel('No expiry; I can revoke this purpose later', { exact: true })
    .uncheck();
  const date = new Date(Date.now() + 86400000),
    local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  await page
    .getByLabel('Expiry date and time (device timezone)', { exact: true })
    .fill(local);
  await page
    .getByRole('button', { name: 'Review decision', exact: true })
    .click();
  await page
    .getByLabel('I reviewed this purpose, the data used and this decision', {
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Save consent decision', exact: true })
    .click();
  await expect(consentCard(page, externalPurpose)).toContainText('version 2');
  await saveConsentUI(page, externalPurpose, 'revocation');
  await expect(consentCard(page, externalPurpose)).toContainText('revoked');
  await page.getByText('Consent decision history', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Refresh consent history', exact: true })
    .click();
  await expect(consentRegion(page).getByRole('listitem')).toHaveCount(3);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await consentRegion(page).screenshot({
    path: testInfo.outputPath('synthetic-purpose-consent.png'),
  });
  await page
    .getByRole('link', { name: 'Back to your account', exact: true })
    .click();
  await page.goBack();
  await expect(consentCard(page, externalPurpose)).toContainText('revoked');
});
test('E2E-WEB-761 lost real consent response replays historical grant with currentGET503 then recovers actual revoked state @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await open(page);
  let lost = false,
    failRead = false,
    original: ReturnType<typeof ConsentReceiptSchema.parse> | undefined;
  const routes = await trackedConsentRoutes(
    page,
    /\/api\/v1\/account\/consents(?:[/?]|$)/,
    async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'POST' && !lost) {
        lost = true;
        const response = await route.fetch({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
        expect(response.status()).toBe(201);
        original = ConsentReceiptSchema.parse(await response.json());
        await route.abort('failed');
      } else if (url.pathname === consentPath && failRead)
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic current permission outage.',
          }),
        });
      else
        await route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
    },
  );
  try {
    await consentCard(page, externalPurpose)
      .getByRole('button', { name: 'Review grant', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Review decision', exact: true })
      .click();
    await page
      .getByLabel('I reviewed this purpose, the data used and this decision', {
        exact: true,
      })
      .check();
    await page
      .getByRole('button', { name: 'Save consent decision', exact: true })
      .click();
    await expect(consentRegion(page).getByRole('alert')).toBeVisible();
    await routes.idle();
    expect(original?.state.version).toBe(1);
    expect(
      (
        await call(
          page,
          `${consentPath}/${externalPurpose}`,
          'POST',
          consentInput('revoke', 1),
        )
      ).status,
    ).toBe(201);
    failRead = true;
    await page
      .getByRole('button', { name: 'Save consent decision', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Saved consent receipt', exact: true }),
    ).toContainText('grant · version 1');
    await expect(consentRegion(page)).toContainText(
      'Synthetic current permission outage.',
    );
    await expect(consentRegion(page)).toContainText(
      'Current permission is unavailable',
    );
    await expect(consentCard(page, externalPurpose)).toHaveCount(0);
    failRead = false;
    await page
      .getByRole('button', { name: 'Refresh current permissions', exact: true })
      .click();
    await expect(consentCard(page, externalPurpose)).toContainText('revoked');
    await expect(
      page.getByRole('region', { name: 'Saved consent receipt', exact: true }),
    ).toContainText('grant · version 1');
    const history = (await call(page, consentPath + '/history')).body;
    expect(
      history.events.filter(
        (e: { receipt: { requestId: string } }) =>
          e.receipt.requestId === original!.requestId,
      ),
    ).toHaveLength(1);
  } finally {
    await routes.close();
  }
});
test('E2E-WEB-762 actual consent history401 clears Privacy and a held earlier200 cannot restore cards or draft @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await open(page);
  await saveConsentUI(page, externalPurpose);
  let release!: () => void, admitted!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      admitted = resolve;
    });
  const routes = await trackedConsentRoutes(
    page,
    '**/api/v1/account/consents',
    async (route) => {
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + consentPath,
      });
      expect(response.status()).toBe(200);
      admitted();
      await gate;
      try {
        await route.fulfill({ response });
      } catch {
        /* An actual401 may have unmounted the child. */
      }
    },
  );
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await page
      .getByRole('button', { name: 'Refresh current permissions', exact: true })
      .click();
    await ready;
    await pool.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await page.getByText('Consent decision history', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Refresh consent history', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    release();
    await routes.idle();
    await expect(consentRegion(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Download account JSON', exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
    await routes.close();
    await pool.end();
  }
});
test('E2E-WEB-763 competing consent change keeps expiry draft and requires explicit renewed review @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await open(page);
  await consentCard(page, readingPurpose)
    .getByRole('button', { name: 'Review grant', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review decision', exact: true })
    .click();
  await page
    .getByLabel('I reviewed this purpose, the data used and this decision', {
      exact: true,
    })
    .check();
  expect(
    (
      await call(
        page,
        `${consentPath}/${readingPurpose}`,
        'POST',
        consentInput('grant', 0),
      )
    ).status,
  ).toBe(201);
  await page
    .getByRole('button', { name: 'Save consent decision', exact: true })
    .click();
  await expect(consentRegion(page)).toContainText(
    'Consent changed. Review the current version',
  );
  await page
    .getByRole('button', { name: 'Review decision', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Review renew: Personalized reading order',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      'I reviewed this purpose, the data used and this decision',
      { exact: true },
    ),
  ).not.toBeChecked();
  await page
    .getByLabel('I reviewed this purpose, the data used and this decision', {
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Save consent decision', exact: true })
    .click();
  await expect(consentCard(page, readingPurpose)).toContainText('version 2');
});
test('E2E-WEB-764 complete consent download follows all pages and genuine later401 prevents partial download @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await open(page);
  await saveConsentUI(page, externalPurpose);
  await page.evaluate(
    async ({ path, purpose }) => {
      for (let version = 1; version <= 101; version++) {
        const response = await fetch(`${path}/${purpose}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'renew',
            requestId: crypto.randomUUID(),
            expectedVersion: version,
            policyVersion: 'purpose-consent-v1',
            reviewed: true,
            expiresAt: null,
          }),
        });
        if (response.status !== 201)
          throw Error('Actual owned consent history setup failed.');
      }
    },
    { path: consentPath, purpose: externalPurpose },
  );
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download account JSON', exact: true })
    .click();
  const file = await download,
    path = await file.path();
  expect(path).toBeTruthy();
  const exported = CompletePrivacyExportSchema.parse(
    JSON.parse(await readFile(path!, 'utf8')),
  );
  expect(exported.consents.history.events).toHaveLength(102);
  expect(exported.consents.history.complete).toBe(true);
  let downloads = 0;
  page.on('download', () => downloads++);
  const pool = await connectionDatabase(feedbackSandbox);
  const routes = await trackedConsentRoutes(
    page,
    '**/api/v1/account/consents/history?*',
    async (route) => {
      await pool.query(
        "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
      expect(response.status()).toBe(401);
      await route.fulfill({ response });
    },
  );
  try {
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await routes.idle();
    expect(downloads).toBe(0);
    await expect(consentRegion(page)).toHaveCount(0);
  } finally {
    await routes.close();
    await pool.end();
  }
});

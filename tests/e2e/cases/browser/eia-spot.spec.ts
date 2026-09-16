import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  test,
  expect,
  indiaActors,
  eiaInput,
  eiaRights,
} from '../../helpers/eia-spot';
test.use({ namedOperators: true });
test('E2E-WEB-1940 daily oil permission capture independent review and reader navigation @SRC-009 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = eiaInput();
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Daily oil source');
    let ops = page.getByRole('region', { name: 'Daily oil source operations' });
    await expect(
      ops.getByRole('button', { name: 'Fetch original daily table' }),
    ).toBeDisabled();
    await ops.getByLabel('Contributor permission reference').fill(eiaRights);
    await ops
      .getByRole('checkbox', {
        name: 'Enable permitted acquisition and display',
      })
      .check();
    await ops
      .getByRole('checkbox', {
        name: 'I verified contributor storage, display and offline rights.',
      })
      .check();
    await ops
      .getByRole('button', { name: 'Save daily source permission' })
      .click();
    await expect(ops.getByLabel('Original EIA daily HTML')).toBeEnabled();
    await ops.getByLabel('Original EIA daily HTML').setInputFiles({
      name: 'synthetic-daily.html',
      mimeType: 'text/html',
      buffer: Buffer.from(data.body),
    });
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/eia-spot/capture') &&
        r.request().method() === 'POST',
    );
    await ops.getByRole('button', { name: 'Retain daily HTML' }).click();
    expect((await saved).status()).toBe(201);
    await expect(ops).toContainText('State: draft');
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'Daily oil source');
    ops = page.getByRole('region', { name: 'Daily oil source operations' });
    await ops.getByRole('button', { name: 'Inspect daily original' }).click();
    await expect(ops.locator('pre')).toContainText('TEST-SIMULATION');
    await ops.getByRole('button', { name: 'Close daily original' }).click();
    await ops
      .getByLabel('Daily source review reason')
      .fill('Independent daily crude dates, units and permission reviewed.');
    await ops
      .getByRole('checkbox', {
        name: 'I independently verified crude units, dates, cells and rights.',
      })
      .check();
    await ops.getByRole('button', { name: 'Publish daily capture' }).click();
    await expect(ops).toContainText('State: publish');
    await page.goto('/#daily-oil');
    const reader = page.getByRole('region', { name: 'Daily crude spot' });
    await expect(reader).toContainText('not live quotes');
    await expect(reader).toContainText('Not reported');
    await expect(reader.getByRole('table')).toBeVisible();
    const details = reader.getByText('Source and reuse limits', {
      exact: true,
    });
    await details.focus();
    await details.press('Enter');
    await expect(reader).toContainText('Missing cells are not zero.');
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-WEB-1943 daily edition selection retry and browser Back preserve exact source with keyboard focus @SRC-009 @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { retentionHeaders, eiaReview } =
      await import('../../helpers/eia-spot'),
    reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: eiaRights },
        })
      ).status(),
    ).toBe(201);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const input = eiaInput();
      input.body = input.body.replaceAll('10.00', i ? '10.50' : '10.00');
      expect(
        (
          await request.post('/api/v1/ops/eia-spot/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/eia-spot/review', {
            headers: retentionHeaders,
            data: eiaReview(input.requestId),
          })
        ).status(),
      ).toBe(201);
      ids.push(input.requestId);
    }
    let fault = true;
    const requests: string[] = [];
    await page.route('**/api/v1/eia-spot**', async (route) => {
      const url = new URL(route.request().url()),
        edition = url.searchParams.get('edition');
      requests.push(edition ?? 'current');
      if (edition === ids[0] && fault) {
        fault = false;
        await route.abort('failed');
        return;
      }
      await route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#daily-oil');
    const reader = page.getByRole('region', { name: 'Daily crude spot' }),
      heading = reader.getByRole('heading', {
        name: 'Daily oil observations',
        exact: true,
      });
    await expect(reader.getByLabel('Retained daily oil edition')).toHaveValue(
      ids[1]!,
    );
    await expect(heading).not.toBeFocused();
    await reader.getByLabel('Retained daily oil edition').selectOption(ids[0]!);
    await expect(page).toHaveURL(new RegExp('edition=' + ids[0]));
    await expect(reader.getByRole('alert')).toBeFocused();
    await reader
      .getByRole('button', { name: 'Retry daily oil', exact: true })
      .press('Enter');
    await expect(heading).toBeFocused();
    await expect(reader.getByLabel('Retained daily oil edition')).toHaveValue(
      ids[0]!,
    );
    expect(requests.filter((id) => id === ids[0])).toHaveLength(2);
    await reader.getByLabel('Retained daily oil edition').selectOption(ids[1]!);
    await expect(heading).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp('edition=' + ids[0]));
    await expect(reader.getByLabel('Retained daily oil edition')).toHaveValue(
      ids[0]!,
    );
    await expect(heading).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await reviewer.dispose();
  }
});

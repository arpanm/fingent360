import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  prepareConnectionBrowser,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import { prepareReportResearchBrowser } from '../../helpers/report-research-fixture';
import {
  ReportComparisonSchema,
  PrivacyExportSchema,
  ReportJobSchema,
} from '../../../../packages/contracts/src/index';
import {
  browserComparisonCall,
  changeComparisonRecords,
  comparisonRoute,
  comparisonPath,
  comparisonBase,
  issueComparisonReport,
  escapedComparisonLabel,
} from '../../helpers/report-comparison';
function outbound(page: Page) {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) requests.push(r.url());
  });
  return requests;
}
async function setup(page: Page) {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  const call = browserComparisonCall(page),
    a = await issueComparisonReport(call);
  await changeComparisonRecords(call);
  const b = await issueComparisonReport(call, escapedComparisonLabel);
  return { a, b, call };
}

test('E2E-OFFLINE-430 actual local originals compare exactly with keyboard mobile original Back reload and zero network @REPORT-COMPARE-001', async ({
  page,
}) => {
  const requests = outbound(page),
    { a, b, call } = await setup(page);
  const before = PrivacyExportSchema.parse(
    (await call('/api/v1/account/privacy/export')).body,
  );
  const compared = await call(comparisonPath(b.id, a.id));
  expect(compared.status).toBe(200);
  const value = ReportComparisonSchema.parse(compared.body);
  expect(value.earlier.id).toBe(a.id);
  expect(value.recordedCost.difference).toBe('-1');
  expect(
    value.holdings[0]!.fields.find((f) => f.field === 'quantity')!.difference,
  ).toBe('1');
  await page.goto('/#reports');
  await page
    .getByRole('link', { name: 'Compare issued reports', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('First report', { exact: true }).selectOption(b.id);
  await page.getByLabel('Second report', { exact: true }).selectOption(a.id);
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Compare captured records', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  const region = page.getByRole('region', {
    name: 'Issued report comparison',
    exact: true,
  });
  await expect(region).toContainText('INR −0.01');
  await expect(region).toContainText(escapedComparisonLabel);
  await expect(region.locator('img')).toHaveCount(0);
  await region
    .getByRole('link', { name: 'Open earlier original', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toContainText(a.label);
  await page.keyboard.press('Escape');
  await page.goBack();
  await expect(region).toContainText('INR +2.46');
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(region).toContainText(escapedComparisonLabel);
  await page.setViewportSize({ width: 360, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const after = PrivacyExportSchema.parse(
    (await call('/api/v1/account/privacy/export')).body,
  );
  expect(after.reports).toEqual(before.reports);
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.allocations).toEqual(before.allocations);
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-431 queued cancelled duplicate deleted and foreign originals fail without hidden copies or local issuance @REPORT-COMPARE-001', async ({
  page,
}) => {
  const requests = outbound(page),
    { a, b, call } = await setup(page),
    id = randomUUID();
  const pending = ReportJobSchema.parse(
    (
      await call('/api/v1/account/reports', 'POST', {
        requestId: id,
        label: 'Synthetic pending local original',
        consent: true,
      })
    ).body,
  );
  expect(pending.status).toBe('queued');
  expect((await call(comparisonPath(a.id, id))).status).toBe(409);
  const exportQueued = PrivacyExportSchema.parse(
    (await call('/api/v1/account/privacy/export')).body,
  );
  expect(exportQueued.reports.jobs.find((j) => j.id === id)!.status).toBe(
    'queued',
  );
  expect(
    (
      await call(`/api/v1/account/reports/${id}/cancel`, 'POST', {
        expectedVersion: pending.version,
      })
    ).status,
  ).toBe(201);
  expect((await call(comparisonPath(a.id, id))).status).toBe(409);
  for (const path of [
    comparisonPath(a.id, a.id),
    `${comparisonPath(a.id, b.id)}&unknown=yes`,
    `${comparisonPath(a.id, b.id)}&first=${b.id}`,
  ])
    expect((await call(path)).status).toBe(400);
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(
    page.getByRole('region', { name: 'Issued report comparison', exact: true }),
  ).toBeVisible();
  expect(
    (
      await call(`/api/v1/account/reports/${b.id}`, 'DELETE', {
        expectedVersion: b.version,
        confirm: true,
      })
    ).status,
  ).toBe(200);
  await page
    .getByRole('button', { name: 'Refresh comparison', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Issued report comparison', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('unavailable');
  expect((await call('/api/v1/account/logout', 'POST')).status).toBe(200);
  await prepareConnectionBrowser(page);
  expect((await call(comparisonPath(a.id, b.id))).status).toBe(404);
  expect((await call(`${comparisonBase}/options`)).body).toEqual({
    reports: [],
  });
  expect(requests).toEqual([]);
});

test('E2E-OFFLINE-432 v2 actual bundled research notes compare historically and account deletion removes every original link @REPORT-COMPARE-001', async ({
  page,
}) => {
  const requests = outbound(page),
    prepared = await prepareReportResearchBrowser(page),
    call = browserComparisonCall(page),
    a = await issueComparisonReport(
      call,
      'Earlier local research',
      prepared.selected,
    ),
    revision = prepared.revisions[0]!;
  expect(
    (
      await call(`/api/v1/account/research-connections/${revision.id}`, 'PUT', {
        action: 'edit',
        requestId: randomUUID(),
        expectedVersion: revision.version,
        note: 'Synthetic changed on-device question',
        storageConsent: true,
      })
    ).status,
  ).toBe(200);
  const b = await issueComparisonReport(
    call,
    'Later local research',
    prepared.selected.map((r) =>
      r.id === revision.id ? { id: r.id, version: r.version + 1 } : r,
    ),
  );
  const compared = ReportComparisonSchema.parse(
    (await call(comparisonPath(a.id, b.id))).body,
  );
  expect(compared.research.comparable).toBe(true);
  expect(
    compared.research.rows
      .find((r) => r.key === revision.id)!
      .fields.find((f) => f.field === 'note')!.after,
  ).toBe('Synthetic changed on-device question');
  await page.goto(comparisonRoute(a.id, b.id));
  await expect(
    page.getByRole('region', { name: 'Issued report comparison', exact: true }),
  ).toContainText('Synthetic changed on-device question');
  expect(
    (await call('/api/v1/account', 'DELETE', { password: connectionPassword }))
      .status,
  ).toBe(200);
  await page
    .getByRole('button', { name: 'Refresh comparison', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Sign in to compare issued reports',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Sign in to compare issued reports',
      exact: true,
    }),
  ).toBeVisible();
  await prepareConnectionBrowser(page);
  expect((await call(comparisonPath(a.id, b.id))).status).toBe(404);
  expect((await call(`${comparisonBase}/options`)).body).toEqual({
    reports: [],
  });
  expect(requests).toEqual([]);
});

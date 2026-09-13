import { test, expect, type Page } from '@playwright/test';
import {
  SecurityDirectorySchema,
  SecurityEvidenceSchema,
  SecurityHistorySchema,
  SecurityIdentitySchema,
  parseSecurityMapping,
} from '../../../../packages/contracts/src/index';

const isin = 'INE002A01018';
async function local(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async (args) => {
      const response = await fetch(`/api/v1${args.path}`, {
        method: args.method,
        headers: { 'Content-Type': 'application/json' },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body },
  );
}

test('E2E-OFFLINE-270 dated real identity search evidence history and Back work without API network @IDENTITY-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#more');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.getByRole('link', { name: /Security directory/ }).click();
  const search = page.getByLabel('Search name, ticker or ISIN', {
    exact: true,
  });
  await search.fill(isin);
  await search.press('Enter');
  const item = page.locator(`a[href="#securities/${isin}"]`);
  await expect(item).toContainText(/RELIANCE/i);
  await item.focus();
  await page.keyboard.press('Enter');
  const detail = page.getByRole('article', {
    name: 'Security identity detail',
  });
  await expect(detail).toContainText('Source edition retrieved');
  await expect(detail).toContainText('Last successful check');
  await detail
    .getByRole('button', { name: 'Identity history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Identity history' }),
  ).toContainText('Edition');
  await detail
    .getByRole('button', { name: 'Original identity evidence', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Original identity evidence' })
      .locator('pre'),
  ).toContainText('RELIANCE');
  const identity = SecurityIdentitySchema.parse(
    (await local(page, `/securities/${isin}`)).body,
  );
  const history = SecurityHistorySchema.parse(
    (await local(page, `/securities/${isin}/history`)).body,
  );
  expect(
    history.revisions.some(
      (v) =>
        v.sourceHash === identity.sourceHash && v.version === identity.version,
    ),
  ).toBe(true);
  const evidence = SecurityEvidenceSchema.parse(
    (await local(page, `/securities/${isin}/evidence/${identity.sourceHash}`))
      .body,
  );
  expect(evidence.isin).toBe(isin);
  expect(evidence.retrievedAt).toBe(identity.retrievedAt);
  expect(parseSecurityMapping(JSON.parse(evidence.body))).toEqual({
    resolution: identity.resolution,
    candidates: identity.candidates,
  });
  const hash = await page.evaluate(
    async (args) => {
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `${args.isin}\n${args.retrievedAt}\n${args.body}`,
        ),
      );
      return Array.from(new Uint8Array(bytes), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
    },
    { isin, retrievedAt: evidence.retrievedAt, body: evidence.body },
  );
  expect(hash).toBe(identity.sourceHash);
  await page.reload();
  await expect(detail).toContainText(`EDITION ${identity.version}`);
  expect(
    SecurityIdentitySchema.parse(
      (await local(page, `/securities/${isin}`)).body,
    ),
  ).toEqual(identity);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Security directory', exact: true }),
  ).toBeVisible();
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-271 snapshot search misses and refresh denial preserve stored identities @IDENTITY-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#securities');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const before = SecurityDirectorySchema.parse(
    (await local(page, '/securities')).body,
  );
  expect(before.items.length).toBeGreaterThanOrEqual(5);
  expect(
    before.items.every(
      (v) =>
        v.source === 'OpenFIGI' && Number.isFinite(Date.parse(v.retrievedAt)),
    ),
  ).toBe(true);
  const search = page.getByLabel('Search name, ticker or ISIN', {
    exact: true,
  });
  await search.fill('No such snapshot security 270');
  await search.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'No stored match yet.', exact: true }),
  ).toBeVisible();
  expect((await local(page, '/securities?q=' + 'a'.repeat(101))).status).toBe(
    400,
  );
  expect(
    (await local(page, `/securities/${isin}/evidence/${'0'.repeat(64)}`))
      .status,
  ).toBe(404);
  expect((await local(page, `/securities/${isin}`, 'POST', {})).status).toBe(
    405,
  );
  const refresh = await local(page, '/ops/securities/refresh', 'POST', {
    requestId: 'e450bd6a-4164-4d85-8e29-c648b16048c1',
    isins: [isin],
  });
  expect(refresh.status).toBeGreaterThanOrEqual(400);
  expect(
    SecurityDirectorySchema.parse((await local(page, '/securities')).body),
  ).toEqual(before);
  expect(network).toEqual([]);
});

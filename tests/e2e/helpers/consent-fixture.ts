import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  ConsentListSchema,
  ConsentReceiptSchema,
  type ConsentPurpose,
  type ConsentWrite,
  consentDescriptions,
} from '../../../packages/contracts/src/index';
import { connectionHeaders } from './research-connection-fixture';
export const consentPath = '/api/v1/account/consents';
export const externalPurpose = 'external-ai-private-context',
  readingPurpose = 'reading-personalization',
  schedulePurpose = 'scheduled-record-reviews';
export const scheduleConfig = {
  label: 'Synthetic consent schedule',
  frequency: 'daily',
  time: '09:00',
  timezone: 'Asia/Kolkata',
  weekday: 1,
  policy: 'saved-record-review-v1',
};
export async function consentView(request: APIRequestContext) {
  const response = await request.get(consentPath);
  expect(response.status()).toBe(200);
  return ConsentListSchema.parse(await response.json());
}
export function consentInput(
  action: ConsentWrite['action'],
  expectedVersion: number,
  extra: Record<string, unknown> = {},
) {
  return {
    action,
    expectedVersion,
    requestId: randomUUID(),
    policyVersion: 'purpose-consent-v1',
    reviewed: true,
    ...(action === 'revoke' ? {} : { expiresAt: null }),
    ...extra,
  };
}
export async function consentWrite(
  request: APIRequestContext,
  purpose: ConsentPurpose,
  action: ConsentWrite['action'],
  extra: Record<string, unknown> = {},
) {
  const view = await consentView(request),
    record = view.purposes.find((p) => p.record.purpose === purpose)!.record;
  const input = consentInput(action, record.version, extra);
  const response = await request.post(`${consentPath}/${purpose}`, {
    headers: connectionHeaders,
    data: input,
  });
  expect(response.status(), await response.text()).toBe(201);
  return { input, receipt: ConsentReceiptSchema.parse(await response.json()) };
}
export async function consentCall(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
export const consentRegion = (page: Page) =>
  page.getByRole('region', { name: 'Purpose consent', exact: true });
export const consentCard = (page: Page, purpose: ConsentPurpose) =>
  consentRegion(page).getByRole('article', {
    name: consentDescriptions[purpose].title,
    exact: true,
  });
export async function saveConsentUI(
  page: Page,
  purpose: ConsentPurpose,
  action: 'grant' | 'renewal' | 'revocation' = 'grant',
) {
  await consentCard(page, purpose)
    .getByRole('button', { name: `Review ${action}`, exact: true })
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
export async function trackedConsentRoutes(
  page: Page,
  pattern: string | RegExp,
  handler: (route: Route) => Promise<void>,
) {
  const active = new Set<Promise<void>>();
  const wrapped = (route: Route) => {
    const pending = handler(route);
    active.add(pending);
    return pending.finally(() => active.delete(pending));
  };
  await page.route(pattern, wrapped);
  const idle = async () => {
    while (active.size) await Promise.all([...active]);
  };
  return {
    idle,
    async close() {
      await idle();
      await page.unroute(pattern, wrapped);
    },
  };
}

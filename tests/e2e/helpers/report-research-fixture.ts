import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  ReportJobSchema,
  ResearchConnectionRevisionSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import {
  seedConnectionSource,
  prepareConnectionAccount,
  prepareConnectionBrowser,
  connectionHeaders,
  actualBundledConnectionSource,
} from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export const reportResearchBase = '/api/v1/account/reports';
export const reportResearchNote =
  'My saved research question; no financial impact is claimed.';
export async function prepareReportResearch(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const source = await seedConnectionSource(sandbox),
    goal = await prepareConnectionAccount(request);
  const revisions = [];
  for (const target of [
    { kind: 'goal', id: goal.id, version: 1 },
    { kind: 'holding', id: 'INE002A01018', version: 1 },
  ]) {
    const response = await request.put(
      `/api/v1/account/research-connections/${randomUUID()}`,
      {
        headers: connectionHeaders,
        data: {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target,
          note: reportResearchNote,
          storageConsent: true,
        },
      },
    );
    expect(response.status()).toBe(200);
    revisions.push(
      ResearchConnectionRevisionSchema.parse(await response.json()),
    );
  }
  return {
    source,
    goal,
    revisions,
    selected: revisions.map(({ id, version }) => ({ id, version })),
  };
}
export async function prepareReportResearchBrowser(
  page: Page,
  sandbox?: FeedbackSandbox,
) {
  const source = sandbox
    ? await seedConnectionSource(sandbox)
    : await actualBundledConnectionSource();
  await page.goto('/');
  if (!sandbox) await expect(page.getByLabel('On-device mode')).toBeVisible();
  await prepareConnectionBrowser(page);
  return createBrowserReportConnections(page, source);
}
async function createBrowserReportConnections(page: Page, source: FeedItem) {
  const result = await page.evaluate(
    async ({ source, note }) => {
      const goals = await (await fetch('/api/v1/account/goals')).json();
      const saved = [];
      for (const target of [
        { kind: 'goal', id: goals.goals[0].id, version: 1 },
        { kind: 'holding', id: 'INE002A01018', version: 1 },
      ]) {
        const response = await fetch(
          `/api/v1/account/research-connections/${crypto.randomUUID()}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              requestId: crypto.randomUUID(),
              expectedVersion: 0,
              source: {
                itemId: source.id,
                version: source.version,
                sourceHash: source.sourceHash,
              },
              target,
              note,
              storageConsent: true,
            }),
          },
        );
        if (!response.ok)
          throw Error(`Owned connection fixture ${response.status}`);
        saved.push(await response.json());
      }
      return {
        source,
        revisions: saved,
        selected: saved.map(
          ({ id, version }: { id: string; version: number }) => ({
            id,
            version,
          }),
        ),
      };
    },
    { source, note: reportResearchNote },
  );
  const revisions = result.revisions.map((value: unknown) =>
    ResearchConnectionRevisionSchema.parse(value),
  );
  return {
    ...result,
    revisions,
    selected: revisions.map(({ id, version }) => ({ id, version })),
  };
}
export async function issuedResearchReport(
  request: APIRequestContext,
  id: string,
) {
  await expect
    .poll(
      async () =>
        ReportJobSchema.parse(
          await (await request.get(`${reportResearchBase}/${id}`)).json(),
        ).status,
      { timeout: 15000 },
    )
    .toBe('succeeded');
  return ReportJobSchema.parse(
    await (await request.get(`${reportResearchBase}/${id}`)).json(),
  );
}
export async function chooseResearchReport(
  page: Page,
  label = 'Selected research record review',
  offline = false,
) {
  await page.goto('/#reports');
  if (offline) await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.getByLabel('Report label', { exact: true }).fill(label);
  await page
    .getByRole('checkbox', {
      name: 'Include research connections in this report',
      exact: true,
    })
    .check();
  await page
    .getByRole('region', { name: 'Research connection selection', exact: true })
    .getByRole('checkbox')
    .first()
    .check();
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Review report selection', exact: true })
    .click();
}
export async function captureResearchReport(page: Page) {
  await page
    .getByRole('dialog', { name: 'Review report selection', exact: true })
    .getByRole('button', { name: 'Capture selected report', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Report status', exact: true }),
  ).toContainText('Snapshot stored');
}

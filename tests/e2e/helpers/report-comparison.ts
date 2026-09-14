import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  ReportJobSchema,
  SavedGoalsSchema,
  HoldingsPreviewSchema,
  SavedGoalInputSchema,
} from '../../../packages/contracts/src/index';
import {
  connectionHeaders,
  connectionGoal,
} from './research-connection-fixture';
export const comparisonBase = '/api/v1/account/report-comparison';
export const escapedComparisonLabel =
  '<img src=x onerror="alert(1)"> Synthetic later';
export type ComparisonCall = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<{ status: number; body: unknown }>;
export function apiComparisonCall(request: APIRequestContext): ComparisonCall {
  return async (path, method = 'GET', body) => {
    const response = await request.fetch(path, {
      method,
      headers: connectionHeaders,
      ...(body === undefined ? {} : { data: body }),
    });
    return { status: response.status(), body: await response.json() };
  };
}
export function browserComparisonCall(page: Page): ComparisonCall {
  return (path, method = 'GET', body) =>
    page.evaluate(
      async ({ path, method, body }) => {
        const response = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      },
      { path, method, body },
    );
}
export async function issueComparisonReport(
  call: ComparisonCall,
  label = 'Synthetic earlier',
  selected?: { id: string; version: number }[],
) {
  const id = randomUUID();
  const response = await call('/api/v1/account/reports', 'POST', {
    requestId: id,
    label,
    consent: true,
    ...(selected ? { researchConnections: selected } : {}),
  });
  expect(response.status).toBe(201);
  await expect
    .poll(
      async () =>
        ReportJobSchema.parse(
          (await call(`/api/v1/account/reports/${id}`)).body,
        ).status,
      { timeout: 20000, message: 'The actual owned report must be issued.' },
    )
    .toBe('succeeded');
  return ReportJobSchema.parse(
    (await call(`/api/v1/account/reports/${id}`)).body,
  );
}
// Explicit synthetic financial inputs; every success is created through the real API or serialized device handler.
export async function changeComparisonRecords(call: ComparisonCall) {
  const goals = SavedGoalsSchema.parse(
      (await call('/api/v1/account/goals')).body,
    ),
    goal = goals.goals[0]!;
  const changed = await call(`/api/v1/account/goals/${goal.id}`, 'PUT', {
    expectedVersion: goal.version,
    goal: SavedGoalInputSchema.parse({
      ...connectionGoal,
      name: 'Synthetic changed goal',
      savedMinor: '1003',
      monthlyMinor: '111',
      horizonMonths: 13,
    }),
  });
  expect(changed.status).toBe(200);
  const preview = await call('/api/v1/account/holdings/preview', 'POST', {
    expectedVersion: 1,
    storageConsent: true,
    csv: 'isin,quantity,total_cost_paise\nINE002A01018,3.000002,9999',
  });
  expect(preview.status).toBe(201);
  const p = HoldingsPreviewSchema.parse(preview.body);
  expect(
    (
      await call('/api/v1/account/holdings/confirm', 'POST', {
        previewId: p.previewId,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await call('/api/v1/account/allocations', 'PUT', {
        expectedVersion: 0,
        expectedHoldingsVersion: 2,
        storageConsent: true,
        rows: [
          {
            goalId: goal.id,
            goalVersion: goal.version + 1,
            isin: 'INE002A01018',
            quantity: '1.000001',
          },
        ],
      })
    ).status,
  ).toBe(200);
}
export const comparisonPath = (first: string, second: string) =>
  `${comparisonBase}?first=${first}&second=${second}`;
export const comparisonRoute = (first: string, second: string) =>
  `/#report-compare?first=${first}&second=${second}`;
export function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
// Hold one actual response after transport, ignoring cancellation only for this
// explicit race fixture. No successful payload or authorization is fabricated.
export async function holdComparisonResponse(page: Page, suffix = '') {
  await page.evaluate(
    ({ base, suffix }) => {
      type Harness = {
        release: () => void;
        restore: () => void;
        seen: boolean;
        status: number;
        active: number;
      };
      const windowWithHold = window as typeof window & {
        reportComparisonHold?: Harness;
      };
      const native = window.fetch.bind(window);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const harness: Harness = {
        release,
        restore: () => {
          window.fetch = native;
          release();
        },
        seen: false,
        status: 0,
        active: 0,
      };
      windowWithHold.reportComparisonHold = harness;
      window.fetch = async (input, init) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
          location.href,
        );
        if (!harness.seen && url.pathname === base + suffix) {
          // Mark before awaiting transport so concurrent reads are not all held.
          harness.seen = true;
          harness.active++;
          try {
            const response = await native(input, { ...init, signal: null });
            harness.status = response.status;
            await gate;
            return response;
          } finally {
            harness.active--;
          }
        }
        return native(input, init);
      };
    },
    { base: comparisonBase, suffix },
  );
}
export async function releaseComparisonResponse(page: Page) {
  await page.evaluate(() => {
    const h = (
      window as typeof window & {
        reportComparisonHold?: { restore: () => void };
      }
    ).reportComparisonHold;
    h?.restore();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              reportComparisonHold?: { active: number };
            }
          ).reportComparisonHold?.active ?? 0,
      ),
    )
    .toBe(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
export async function waitComparisonHeld(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              reportComparisonHold?: { status: number };
            }
          ).reportComparisonHold?.status ?? 0,
      ),
    )
    .toBe(200);
}

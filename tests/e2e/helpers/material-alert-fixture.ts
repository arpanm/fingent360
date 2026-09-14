import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  MacroDashboardSchema,
  MacroHistorySchema,
  MacroObservationSchema,
  MaterialViewSchema,
  MaterialWriteSchema,
  MaterialReceiptSchema,
  type MacroIndicator,
  type MacroObservation,
} from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  connectionDatabase,
  connectionHeaders,
  connectionPassword,
} from './research-connection-fixture';
export const materialPath = '/api/v1/account/inbox/material';
export const gdp: MacroIndicator = 'NY.GDP.MKTP.KD.ZG',
  cpi: MacroIndicator = 'FP.CPI.TOTL.ZG';
export const materialNames = {
  [gdp]: 'GDP growth',
  [cpi]: 'Consumer inflation',
};
export async function materialView(request: APIRequestContext) {
  const response = await request.get(materialPath);
  expect(response.status()).toBe(200);
  return MaterialViewSchema.parse(await response.json());
}
export async function materialWrite(
  request: APIRequestContext,
  extra: Record<string, unknown>,
) {
  const view = await materialView(request);
  const input = MaterialWriteSchema.parse({
    expectedVersion: view.state.version,
    requestId: randomUUID(),
    ...extra,
  });
  const response = await request.post(materialPath, {
    headers: connectionHeaders,
    data: input,
  });
  expect(response.status(), await response.text()).toBe(200);
  return { input, receipt: MaterialReceiptSchema.parse(await response.json()) };
}
export async function followMaterial(
  request: APIRequestContext,
  indicators: MacroIndicator[] = [gdp, cpi],
) {
  expect(
    (
      await request.put('/api/v1/account/watchlist', {
        headers: connectionHeaders,
        data: { indicators },
      })
    ).status(),
  ).toBe(200);
}
export async function configureMaterial(
  request: APIRequestContext,
  indicators: MacroIndicator[] = [gdp],
) {
  return materialWrite(request, {
    action: 'configure',
    policies: indicators.map((indicator) => ({
      indicator,
      thresholdPoints: '1',
    })),
    storageConsent: true,
  });
}
export async function seedMaterialObservation(
  sandbox: FeedbackSandbox,
  year: number,
  value: string | null,
  indicator: MacroIndicator = gdp,
  overrides: Partial<MacroObservation> = {},
) {
  const pool = await connectionDatabase(sandbox);
  try {
    const prior = (
      await pool.query(
        'SELECT id,revision FROM macro_observations WHERE indicator=$1 AND year=$2 ORDER BY revision DESC LIMIT 1',
        [indicator, year],
      )
    ).rows[0];
    const at = new Date().toISOString();
    const observation = MacroObservationSchema.parse({
      id: randomUUID(),
      indicator,
      year,
      value,
      revision: (prior?.revision ?? 0) + 1,
      supersedesId: prior?.id ?? null,
      unit: 'annual_percent',
      country: 'IND',
      providerUpdatedAt: at.slice(0, 10),
      retrievedAt: at,
      sourceHash: 'b'.repeat(64),
      sourceUrl: 'https://example.com/material-alert-test-simulation',
      ...overrides,
    });
    const run = randomUUID();
    await pool.query('BEGIN');
    await pool.query(
      "INSERT INTO macro_runs(id,indicator,finished_at,status,message,inserted,source_hash) VALUES($1,$2,$3,'succeeded','Synthetic material policy test only',1,$4)",
      [run, indicator, at, observation.sourceHash],
    );
    await pool.query(
      'INSERT INTO macro_observations(id,indicator,year,value,provider_updated_at,retrieved_at,source_hash,source_url,revision,supersedes_id,run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        observation.id,
        indicator,
        observation.year,
        observation.value,
        observation.providerUpdatedAt,
        observation.retrievedAt,
        observation.sourceHash,
        observation.sourceUrl,
        observation.revision,
        observation.supersedesId,
        run,
      ],
    );
    await pool.query('COMMIT');
    return observation;
  } finally {
    await pool.query('ROLLBACK');
    await pool.end();
  }
}
export async function seedActualMaterial(sandbox: FeedbackSandbox) {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    macro: unknown;
    macroHistory: Record<string, unknown>;
    generatedAt: string;
  };
  const dashboard = MacroDashboardSchema.parse(bundle.macro);
  for (const source of dashboard.sources) {
    const observation = [...source.observations].sort(
      (a, b) => b.year - a.year || b.revision - a.revision,
    )[0];
    if (!observation || !source.lastSuccessAt)
      throw Error(
        'Actual dated macro bundle observations/check provenance required.',
      );
    const pool = await connectionDatabase(sandbox);
    try {
      const versions = new Map(
        [
          ...source.observations,
          ...Object.values(bundle.macroHistory).flatMap((value) =>
            MacroHistorySchema.parse(value),
          ),
        ]
          .filter((value) => value.indicator === source.indicator)
          .map((value) => [value.id, value]),
      );
      for (const value of [...versions.values()].sort(
        (a, b) => a.year - b.year || a.revision - b.revision,
      )) {
        const run = randomUUID();
        await pool.query(
          "INSERT INTO macro_runs(id,indicator,started_at,finished_at,status,message,inserted,source_hash) VALUES($1,$2,$3,$3,'succeeded','Actual dated public bundle reproduction; no current provider request',1,$4)",
          [run, source.indicator, source.lastSuccessAt, value.sourceHash],
        );
        await pool.query(
          'INSERT INTO macro_observations(id,indicator,year,value,provider_updated_at,retrieved_at,source_hash,source_url,revision,supersedes_id,run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [
            value.id,
            source.indicator,
            value.year,
            value.value,
            value.providerUpdatedAt,
            value.retrievedAt,
            value.sourceHash,
            value.sourceUrl,
            value.revision,
            value.supersedesId,
            run,
          ],
        );
      }
    } finally {
      await pool.end();
    }
  }
  return dashboard;
}
export async function materialBrowserCall(
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
export async function prepareMaterialBrowser(page: Page) {
  expect(
    (
      await materialBrowserCall(page, '/api/v1/account/register', 'POST', {
        username: `material_${randomUUID().slice(0, 12)}`,
        password: connectionPassword,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await materialBrowserCall(page, '/api/v1/account/watchlist', 'PUT', {
        indicators: [gdp],
      })
    ).status,
  ).toBe(200);
  await page.goto('/#account');
  await expect(
    page.getByRole('heading', { name: 'Material changes', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit material thresholds', exact: true }),
  ).toBeEnabled();
}
export async function saveMaterialSettings(page: Page) {
  await page
    .getByRole('button', { name: 'Edit material thresholds', exact: true })
    .click();
  await page.getByLabel('Enable GDP growth threshold', { exact: true }).check();
  await page
    .getByLabel('GDP growth threshold (percentage points)', { exact: true })
    .fill('1');
  await page
    .getByLabel(
      'I agree to store material thresholds, observation snapshots and check history in my account.',
      { exact: true },
    )
    .check();
  await page
    .getByRole('button', { name: 'Review material settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save material settings', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Saved material receipt' }),
  ).toContainText('configure');
  await expect(
    page.getByRole('button', {
      name: 'Check stored observations',
      exact: true,
    }),
  ).toBeEnabled();
}

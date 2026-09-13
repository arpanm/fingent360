import { test, expect, type Page } from '@playwright/test';
import {
  SessionSchema,
  WorkspaceSchema,
  PreviewSchema,
  ReviewSchema,
  CatalogSchema,
} from '../../../../packages/contracts/src/index';
async function call(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
) {
  return page.evaluate(
    async (args) => {
      const response = await fetch(`/api/v1/journey${args.path}`, {
        method: args.method,
        headers: {
          'Content-Type': 'application/json',
          ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
        },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body, token },
  );
}
test('E2E-OFFLINE-203 virtual learning workspace preserves exact imports, revisions and immutable reviews @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  const catalog = CatalogSchema.parse((await call(page, '/catalog')).body);
  expect(catalog.mode).toBe('synthetic');
  expect((await call(page, '/workspace')).status).toBe(401);
  const token = SessionSchema.parse(
    (await call(page, '/workspaces', 'POST', {})).body,
  ).token;
  const other = SessionSchema.parse(
    (await call(page, '/workspaces', 'POST', {})).body,
  ).token;
  const initial = WorkspaceSchema.parse(
    (await call(page, '/workspace', 'GET', undefined, token)).body,
  );
  expect(initial.revision).toBe(0);
  const input = {
    expectedRevision: 0,
    idempotencyKey: crypto.randomUUID(),
    portfolio: { ...initial.portfolio, cash: '100.00' },
  };
  const saved = WorkspaceSchema.parse(
    (await call(page, '/workspace', 'POST', input, token)).body,
  );
  expect(saved.valuation.total).toBe('100.00');
  expect((await call(page, '/workspace', 'POST', input, token)).body).toEqual(
    saved,
  );
  expect(
    (
      await call(
        page,
        '/workspace',
        'POST',
        { ...input, portfolio: { ...input.portfolio, cash: '101.00' } },
        token,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await call(
        page,
        '/workspace',
        'POST',
        { ...input, idempotencyKey: crypto.randomUUID() },
        token,
      )
    ).status,
  ).toBe(409);
  const review = ReviewSchema.parse(
    (await call(page, '/reviews', 'POST', { scenario: 'baseline' }, token))
      .body,
  );
  const csv = 'instrumentId,quantity\nalpha-air,1';
  const price = catalog.companies.find((v) => v.id === 'alpha-air')!.price;
  const preview = PreviewSchema.parse(
    (
      await call(
        page,
        '/previews',
        'POST',
        { csv, cash: '0.00', sourceTotal: price },
        token,
      )
    ).body,
  );
  expect(preview.matched).toBe(true);
  const confirm = {
    previewId: preview.id,
    expectedRevision: 1,
    idempotencyKey: crypto.randomUUID(),
  };
  expect((await call(page, '/imports', 'POST', confirm, other)).status).toBe(
    404,
  );
  const imported = WorkspaceSchema.parse(
    (await call(page, '/imports', 'POST', confirm, token)).body,
  );
  expect(imported.revision).toBe(2);
  expect((await call(page, '/imports', 'POST', confirm, token)).body).toEqual(
    imported,
  );
  const duplicate = PreviewSchema.parse(
    (
      await call(
        page,
        '/previews',
        'POST',
        { csv, cash: '0.00', sourceTotal: price },
        token,
      )
    ).body,
  );
  expect(
    (
      await call(
        page,
        '/imports',
        'POST',
        {
          previewId: duplicate.id,
          expectedRevision: 2,
          idempotencyKey: crypto.randomUUID(),
        },
        token,
      )
    ).status,
  ).toBe(409);
  await page.reload();
  expect(
    (await call(page, `/reviews/${review.id}`, 'GET', undefined, token)).body,
  ).toEqual(review);
  expect(
    (await call(page, `/reviews/${review.id}`, 'GET', undefined, other)).status,
  ).toBe(404);
  expect(
    WorkspaceSchema.parse(
      (await call(page, '/workspace', 'GET', undefined, token)).body,
    ).revision,
  ).toBe(2);
  await call(page, '/workspace', 'DELETE', undefined, token);
  expect((await call(page, '/workspace', 'GET', undefined, token)).status).toBe(
    401,
  );
  await call(page, '/workspace', 'DELETE', undefined, other);
});

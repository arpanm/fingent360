import { test, expect } from '../../helpers/app-fixture';
import { ingestBea } from '../../helpers/bea-fixture';
import { operatorKey } from '../../helpers/operator';
import { BeaValidationSchema } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-500 retained BEA inspect Back revalidate review and stage @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'BEA retained response recovery',
  });
  await region
    .getByRole('button', { name: 'Inspect attempt', exact: true })
    .click();
  await region
    .getByRole('button', { name: 'Inspect retained response' })
    .click();
  await expect(
    region.getByRole('heading', { name: 'Protected retained RSS' }),
  ).toBeVisible();
  await region.getByRole('button', { name: 'Back to attempt' }).click();
  await region
    .getByRole('button', { name: 'Revalidate stored response' })
    .click();
  await expect(
    region.getByRole('heading', { name: 'Review candidates' }),
  ).toBeVisible();
  await region.getByRole('button', { name: 'Stage reviewed drafts' }).click();
  await expect(region.getByRole('status')).toContainText(
    'Nothing was published',
  );
  await page.reload();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  await expect(
    region.getByRole('button', { name: 'Inspect attempt' }),
  ).toBeVisible();
  await region.getByRole('button', { name: 'Inspect attempt' }).click();
  await region.getByRole('button', { name: 'Saved recovery history' }).click();
  await expect(
    region.getByRole('region', { name: 'Recovery history' }),
  ).toContainText('Staged');
  await region
    .getByRole('button', { name: /^Open validation / })
    .first()
    .click();
  await expect(
    region.getByRole('heading', { name: 'Review candidates' }),
  ).toBeVisible();
});
test('E2E-WEB-501 recovery creates first drafts and opens actual publication review @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION synthetic_draft_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic stage rollback'; END $$",
    );
    await pool.query(
      'CREATE TRIGGER synthetic_draft_failure BEFORE INSERT ON discovery_versions FOR EACH ROW EXECUTE FUNCTION synthetic_draft_failure()',
    );
    await ingestBea(feedbackSandbox);
  } finally {
    await pool.query(
      'DROP TRIGGER IF EXISTS synthetic_draft_failure ON discovery_versions',
    );
    await pool.query('DROP FUNCTION IF EXISTS synthetic_draft_failure()');
    await pool.end();
  }
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'BEA retained response recovery',
  });
  await region.getByRole('button', { name: 'Inspect attempt' }).click();
  await region
    .getByRole('button', { name: 'Revalidate stored response' })
    .click();
  await expect(
    region.getByRole('heading', { name: 'Review candidates' }),
  ).toBeVisible();
  await region.getByRole('button', { name: 'Stage reviewed drafts' }).click();
  await expect(region.getByRole('status')).toContainText(
    'Nothing was published',
  );
  await page.route('**/ops/discovery/queue', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic list unavailable' }),
    }),
  );
  await region
    .getByRole('button', { name: 'Open staged drafts for review' })
    .click();
  const queue = page.getByRole('region', {
    name: 'Publishing queue',
    exact: true,
  });
  await expect(queue.getByRole('alert')).toContainText(
    'Synthetic list unavailable',
  );
  await page.unroute('**/ops/discovery/queue');
  await queue.getByRole('button', { name: 'Retry publishing page' }).click();
  await expect(
    queue.getByRole('button', { name: /^Review / }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  await region.getByRole('button', { name: 'Inspect attempt' }).click();
  await region.getByRole('button', { name: 'Saved recovery history' }).click();
  await expect(
    region.getByRole('region', { name: 'Recovery history' }),
  ).toContainText('Staged');
  await page.getByRole('button', { name: 'Publishing', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^Review / }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Review / })
    .first()
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Review publication' }),
  ).toBeVisible();
});
test('E2E-WEB-502 lost validation reply replays receipt then actual401 clears recovery @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'BEA retained response recovery',
  });
  await region.getByRole('button', { name: 'Inspect attempt' }).click();
  let dropped = false;
  const sent: string[] = [];
  const receipts: ReturnType<typeof BeaValidationSchema.parse>[] = [];
  await page.route(
    '**/ops/discovery/bea-attempts/*/revalidate',
    async (route) => {
      sent.push(route.request().postData()!);
      const u = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + u.pathname,
      });
      expect(response.status()).toBe(201);
      receipts.push(BeaValidationSchema.parse(await response.json()));
      if (!dropped) {
        expect(response.status()).toBe(201);
        dropped = true;
        await route.abort('failed');
      } else await route.fulfill({ response });
    },
  );
  try {
    await region
      .getByRole('button', { name: 'Revalidate stored response' })
      .click();
    await region
      .getByRole('button', { name: 'Retry same recovery request' })
      .click();
    await expect(
      region.getByRole('heading', { name: 'Review candidates' }),
    ).toBeVisible();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(sent[0]);
    expect(receipts).toHaveLength(2);
    expect(receipts[1]).toEqual(receipts[0]);
    const { connectionDatabase } =
      await import('../../helpers/research-connection-fixture');
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      expect(
        Number(
          (await pool.query('SELECT count(*) AS n FROM bea_revalidations'))
            .rows[0].n,
        ),
      ).toBe(1);
      await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
    } finally {
      await pool.end();
    }
    const denied = page.waitForResponse(
      (r) => r.url().includes('/bea-attempts') && r.status() === 401,
    );
    await region.getByRole('button', { name: 'Reload attempts' }).click();
    await denied;
    await expect(region).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Review candidates' }),
    ).toHaveCount(0);
  } finally {
    await page.unroute('**/ops/discovery/bea-attempts/*/revalidate');
  }
});
test('E2E-WEB-503 late actual401 after recovery Back clears same-session Operations @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const ordinary = new Set<unknown>();
  page.on('request', (r) => {
    if (
      new URL(r.url()).pathname.startsWith('/api/') &&
      !r.url().includes('/evidence')
    )
      ordinary.add(r);
  });
  page.on('requestfinished', (r) => ordinary.delete(r));
  page.on('requestfailed', (r) => ordinary.delete(r));
  await ingestBea(feedbackSandbox);
  await page.goto('/#ops');
  await page.evaluate(
    async (key) => {
      await fetch('/api/v1/ops/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
    },
    await operatorKey(),
  );
  await page.reload();
  await page.getByRole('button', { name: 'BEA recovery', exact: true }).click();
  const region = page.getByRole('region', {
    name: 'BEA retained response recovery',
  });
  await region.getByRole('button', { name: 'Inspect attempt' }).click();
  let releaseFetch!: () => void,
    releaseDenial!: () => void,
    finish!: () => void,
    status = 0,
    started = false;
  const fetchGate = new Promise<void>((r) => (releaseFetch = r)),
    denialGate = new Promise<void>((r) => (releaseDenial = r)),
    drained = new Promise<void>((r) => (finish = r));
  await page.route(
    '**/ops/discovery/bea-attempts/*/evidence',
    async (route) => {
      started = true;
      try {
        await fetchGate;
        const u = new URL(route.request().url());
        const response = await route.fetch({
          url: feedbackSandbox.apiOrigin + u.pathname,
        });
        status = response.status();
        await denialGate;
        await route.fulfill({ response }).catch(() => {});
      } finally {
        finish();
      }
    },
  );
  try {
    await region
      .getByRole('button', { name: 'Inspect retained response' })
      .click();
    await expect.poll(() => started).toBe(true);
    await region.getByRole('button', { name: 'Back to Operations' }).click();
    await expect(region).toHaveCount(0);
    // The held evidence request has not reached the server. Publishing remains an authenticated, settled view.
    await expect(
      page.getByRole('button', { name: 'BEA recovery', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Review / }).first(),
    ).toBeVisible();
    await expect.poll(() => ordinary.size).toBe(0);
    const { connectionDatabase } =
      await import('../../helpers/research-connection-fixture');
    const pool = await connectionDatabase(feedbackSandbox);
    try {
      await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
    } finally {
      await pool.end();
    }
    releaseFetch();
    await expect.poll(() => status).toBe(401);
    await expect(
      page.getByRole('button', { name: 'BEA recovery', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toHaveCount(0);
    releaseDenial();
    await drained;
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'BEA recovery', exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseFetch();
    releaseDenial();
    if (started) await drained;
    await page.unroute('**/ops/discovery/bea-attempts/*/evidence');
  }
});

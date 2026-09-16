import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('E2E-WEB-1650 independent read-only viewer exposes actual persisted incident and keyboard refresh @DEV-021 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  const { startMonitor } = await import(
    new URL('../../../../scripts/uptime-monitor.mjs', import.meta.url).href
  );
  const portServer = createServer();
  await new Promise<void>((done) => portServer.listen(0, '127.0.0.1', done));
  const address = portServer.address();
  if (!address || typeof address === 'string')
    throw Error('Fixture listener absent');
  const port = address.port;
  await new Promise<void>((done) => portServer.close(() => done()));
  const target = createServer((_req, res) => res.writeHead(503).end());
  await new Promise<void>((done) => target.listen(0, '127.0.0.1', done));
  const targetAddress = target.address();
  if (!targetAddress || typeof targetAddress === 'string')
    throw Error('Target listener absent');
  const dir = await mkdtemp(join(tmpdir(), 'f360-uptime-ui-'));
  let stop: (() => Promise<void>) | undefined;
  try {
    const file = join(dir, 'config.json');
    await writeFile(
      file,
      JSON.stringify({
        port,
        allowLoopback: true,
        targets: [
          {
            id: 'owned-api',
            url: `http://127.0.0.1:${targetAddress.port}/api/v1/health`,
          },
        ],
      }),
    );
    stop = await startMonitor(file, join(dir, 'state.json'));
    await expect
      .poll(async () => {
        const value = await (
          await request.get(`http://127.0.0.1:${port}/state`)
        ).json();
        return value.incidents.length;
      })
      .toBe(1);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#targets')).toContainText('owned-api: failed');
    await expect(page.locator('#incidents')).toContainText('Open');
    const refresh = page.getByRole('button', { name: 'Refresh observations' });
    await refresh.focus();
    await refresh.press('Enter');
    await expect(page.locator('#status')).toContainText(
      'retained observations',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await request.post(`http://127.0.0.1:${port}/state`, {
          data: { target: 'http://169.254.169.254' },
        })
      ).status(),
    ).toBe(403);
  } finally {
    if (stop) await stop();
    await new Promise<void>((done) => target.close(() => done()));
    await rm(dir, { recursive: true, force: true });
  }
});

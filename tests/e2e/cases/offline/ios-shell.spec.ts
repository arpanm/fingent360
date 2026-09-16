import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('E2E-OFFLINE-1560 iOS packaging config rejects insecure and credential-bearing destinations @DEV-029 @TEST-SIMULATION', async () => {
  const { validateIosConfig } = await import(
    new URL('../../../../ios/project.mjs', import.meta.url).href
  );
  expect(validateIosConfig({ mode: 'offline', webUrl: '' })).toEqual({
    mode: 'offline',
    webUrl: '',
  });
  expect(
    validateIosConfig({ mode: 'connected', webUrl: 'https://app.example' }),
  ).toMatchObject({ mode: 'connected' });
  for (const webUrl of [
    'http://app.example',
    'https://name:secret@app.example',
    'https://app.example/path',
    'https://app.example/?token=secret',
    'https://app.example/#today',
  ])
    expect(() => validateIosConfig({ mode: 'connected', webUrl })).toThrow();
  expect(() =>
    validateIosConfig({ mode: 'offline', webUrl: 'https://app.example' }),
  ).toThrow();
});
test('E2E-OFFLINE-1561 iOS bootstrap reports missing secure primitives without starting private workflows @DEV-029 @TEST-SIMULATION', async ({
  page,
}) => {
  const source = await readFile(
    new URL('../../../../ios/bootstrap.js', import.meta.url),
    'utf8',
  );
  await page.goto('about:blank');
  await page.evaluate(() =>
    Object.defineProperty(window, 'crypto', {
      value: undefined,
      configurable: true,
    }),
  );
  await page.addScriptTag({ content: source });
  await expect(page.locator('body')).toContainText(
    'cannot provide the secure storage',
  );
  await expect(page.locator('script[type="module"]')).toHaveCount(0);
});

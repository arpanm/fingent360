import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { FeedSchema } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const headers = () => ({
  Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
});
async function publishedTerm(page: Page) {
  const response = await page.request.get('/api/v1/discovery/feed?kind=term');
  expect(response.status()).toBe(200);
  const item = FeedSchema.parse(await response.json()).items[0];
  expect(
    item,
    'Publish an authored glossary edition before discovery quality acceptance.',
  ).toBeTruthy();
  return item!;
}
async function settleViewport(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const header = await page.locator('.experience-topbar').boundingBox();
  expect(header?.y).toBe(0);
  const bottom = page.getByRole('navigation', { name: 'Mobile navigation' });
  if (await bottom.isVisible()) {
    const box = (await bottom.boundingBox())!;
    expect(
      Math.abs(box.y + box.height - (await page.evaluate(() => innerHeight))),
    ).toBeLessThanOrEqual(1);
  }
}
test('E2E-WEB-133 tab origins, More directory and innermost dialog navigation @UX-002', async ({
  page,
  isMobile,
}) => {
  const item = await publishedTerm(page);
  await page.goto('/#explore');
  await page.getByLabel('Search topics and reading').fill(item.title);
  await page.locator(`a.headline-link[data-item-id="${item.id}"]`).click();
  const nav = page.getByRole('navigation', {
    name: isMobile ? 'Mobile navigation' : 'Product areas',
  });
  await expect(
    nav.getByRole('link', { name: 'Explore', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Version history' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#read/${item.id}$`));
  await nav.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/#explore$/);
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await page.locator('.more-links a[href="#account"]').click();
  await expect(page).toHaveURL(/#account$/);
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await expect(page).toHaveURL(/#more$/);
  await expect(
    page.getByRole('heading', { name: 'A place for everything.' }),
  ).toBeVisible();
});
test('E2E-WEB-134 deliberate swipe preference, undo, vertical and cancel safety @UX-002', async ({
  page,
}) => {
  const item = await publishedTerm(page),
    password = 'E2E-gesture-only-passphrase-2026';
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers: headers(),
        data: {
          username: `e2e_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    const ready = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/account/library') && r.ok(),
    );
    await page.goto(`/#read/${item.id}`);
    await ready;
    const intro = page.locator('.reading-gesture-area');
    await intro.scrollIntoViewIfNeeded();
    const box = await intro.boundingBox();
    expect(box).toBeTruthy();
    const x = Math.max(45, box!.x + 45),
      y = box!.y + Math.min(85, box!.height / 2);
    const more = page
      .locator('.reader-actions')
      .getByRole('button', { name: 'More like this', exact: true });
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 110, y + 2, { steps: 5 });
    await page.mouse.up();
    await expect(more).toHaveAttribute('aria-pressed', 'true');
    await page
      .locator('.reader-notice')
      .getByRole('button', { name: 'Undo' })
      .click();
    await expect(more).toHaveAttribute('aria-pressed', 'false');
    await intro.scrollIntoViewIfNeeded();
    const next = await intro.boundingBox();
    const yy = next!.y + 40;
    await page.mouse.move(x, yy);
    await page.mouse.down();
    await page.mouse.move(x + 4, yy + 110, { steps: 5 });
    await page.mouse.up();
    await expect(more).toHaveAttribute('aria-pressed', 'false');
    await intro.dispatchEvent('pointerdown', {
      clientX: x,
      clientY: yy,
      pointerId: 9,
      pointerType: 'touch',
      isPrimary: true,
    });
    await intro.dispatchEvent('pointermove', {
      clientX: x + 100,
      clientY: yy,
      pointerId: 9,
      pointerType: 'touch',
      isPrimary: true,
    });
    await intro.dispatchEvent('pointercancel', {
      clientX: x + 100,
      clientY: yy,
      pointerId: 9,
      pointerType: 'touch',
      isPrimary: true,
    });
    await expect(more).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers: headers(),
      data: { password },
    });
  }
});
test('E2E-WEB-135 public viewport and large-text evidence @UX-002', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const item = await publishedTerm(page);
  for (const size of [
    { width: 320, height: 780 },
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 430, height: 900 },
    { width: 640, height: 360 },
  ]) {
    await page.setViewportSize(size);
    // A distinct document visit avoids treating a viewport artifact as Back.
    // Actual return-scroll behavior remains covered by WEB130/133.
    await page.goto(`/?visual=today-${size.width}#today`);
    await expect(page.locator('.editorial-item').first()).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    await settleViewport(page);
    await page.screenshot({
      path: `artifacts/ux2-viewport-${testInfo.project.name}-today-${size.width}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `artifacts/ux2-visual-${testInfo.project.name}-today-${size.width}.png`,
      fullPage: true,
    });
    const last = page.getByRole('button', {
      name: 'Check for new reading',
      exact: true,
    });
    await last.scrollIntoViewIfNeeded();
    const bottom = page.getByRole('navigation', { name: 'Mobile navigation' });
    if (await bottom.isVisible()) {
      const control = await last.boundingBox(),
        bar = await bottom.boundingBox();
      expect(control!.y + control!.height).toBeLessThanOrEqual(bar!.y + 1);
    }
    await page.goto(`/?visual=reader-${size.width}#read/${item.id}`);
    await expect(
      page.getByRole('heading', { name: item.title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await settleViewport(page);
    await page.screenshot({
      path: `artifacts/ux2-viewport-${testInfo.project.name}-reader-${size.width}.png`,
      fullPage: false,
    });
    await page.screenshot({
      path: `artifacts/ux2-visual-${testInfo.project.name}-reader-${size.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?visual=large-text#today');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.locator('.editorial-item').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/ux2-visual-${testInfo.project.name}-today-large-text.png`,
    fullPage: true,
  });
});

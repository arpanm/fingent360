import { test, expect, eventHeaders } from '../../helpers/event-fixture';
import {
  generatedStoryImage,
  captureStoryPackage,
} from '../../helpers/generated-story-image';
import { isolatedOfflineBuild } from '../../helpers/isolated-offline-build';
import { syntheticPng } from '../../helpers/story-image';
import { MediaAssetSchema } from '../../../../packages/contracts/src/index';
import type { BrowserContext, Page } from '@playwright/test';

// Connected preparation followed by a real isolated offline build. The provider
// transport alone is synthetic; no API/browser response or rendered DOM is mocked.
test('E2E-WEB-1145 generated retained PNG survives real offline packaging and reload; a newly packaged withdrawal suppresses it @STORY-MEDIA-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
  browser,
}, testInfo) => {
  test.setTimeout(480000);
  const f = await generatedStoryImage(request, feedbackSandbox);
  const published = await captureStoryPackage(request, f.source.id);
  const bundledAsset = MediaAssetSchema.parse(published.media[f.source.id]);
  expect(bundledAsset.image?.base64).toBe(syntheticPng);
  expect(bundledAsset.image?.sha256).toBe(f.asset.image!.sha256);
  const packages: Awaited<ReturnType<typeof isolatedOfflineBuild>>[] = [];
  const contexts: BrowserContext[] = [];
  const forbidden: string[] = [];
  async function openPackage(origin: string) {
    const context = await browser.newContext({
      viewport: testInfo.project.use.viewport ?? { width: 1280, height: 720 },
      isMobile: testInfo.project.use.isMobile ?? false,
      hasTouch: testInfo.project.use.hasTouch ?? false,
      deviceScaleFactor: testInfo.project.use.deviceScaleFactor ?? 1,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    contexts.push(context);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'data:' || url.protocol === 'blob:')
        return route.continue();
      if (url.origin !== origin || url.pathname.startsWith('/api/')) {
        forbidden.push(url.origin + url.pathname);
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin + '/#read/' + f.source.id);
    await expect(page.getByLabel('On-device mode')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: f.source.title, exact: true }),
    ).toBeVisible();
    return page;
  }
  async function expectImage(page: Page) {
    const region = page.getByRole('region', {
      name: 'Reviewed visual summary',
    });
    const image = region.locator('img.generated-image');
    await expect(image).toHaveAttribute(
      'src',
      'data:image/png;base64,' + syntheticPng,
    );
    await expect
      .poll(() =>
        image.evaluate((node: HTMLImageElement) => ({
          complete: node.complete,
          width: node.naturalWidth,
          height: node.naturalHeight,
        })),
      )
      .toEqual({ complete: true, width: 1, height: 1 });
    await expect(region).toContainText('AI-generated conceptual illustration');
    await expect(region).toContainText(
      'Based on source edition ' + f.source.version,
    );
    const play = region.getByRole('button', {
      name: 'Play captions',
      exact: true,
    });
    await play.focus();
    await expect(play).toBeFocused();
    await page.keyboard.press('Enter');
    const pause = region.getByRole('button', {
      name: 'Pause captions',
      exact: true,
    });
    await expect(pause).toBeVisible();
    await pause.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  try {
    const installed = await isolatedOfflineBuild(published);
    packages.push(installed);
    const first = await openPackage(installed.origin);
    await expectImage(first);
    await first.reload();
    await expectImage(first);
    expect(forbidden).toEqual([]);
    await first.screenshot({
      path: testInfo.outputPath('synthetic-reviewed-png-offline.png'),
      fullPage: true,
    });

    // Real image-bound withdrawal changes only the connected reviewed asset.
    expect(
      (
        await request.put('/api/v1/ops/media/' + f.source.id, {
          headers: eventHeaders,
          data: { ...f.review, publish: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
      ).status(),
    ).toBe(404);
    // An already installed disconnected package cannot learn later withdrawal.
    await first.reload();
    await expectImage(first);
    const withdrawn = await captureStoryPackage(request, f.source.id);
    expect(withdrawn.media[f.source.id]).toBeUndefined();
    expect(withdrawn.feed.map((row) => row.id)).toContain(f.source.id);
    const replacement = await isolatedOfflineBuild(withdrawn);
    packages.push(replacement);
    expect(replacement.origin).not.toBe(installed.origin);
    const next = await openPackage(replacement.origin);
    for (let pass = 0; pass < 2; pass++) {
      const status = await next.evaluate(
        async (id) =>
          (await fetch('/api/v1/discovery/items/' + id + '/media')).status,
        f.source.id,
      );
      expect(status).toBe(404);
      await expect(next.locator('img.generated-image')).toHaveCount(0);
      await expect(
        next.getByRole('heading', { name: f.source.title, exact: true }),
      ).toBeVisible();
      if (pass === 0) await next.reload();
    }
    expect(forbidden).toEqual([]);
  } finally {
    // Contexts close first, then each owned server/process and temporary build.
    const contextCleanup = await Promise.allSettled(
      contexts.map((context) => context.close()),
    );
    const cleanup = await Promise.allSettled(
      packages.map((value) => value.close()),
    );
    for (const result of [...contextCleanup, ...cleanup])
      expect
        .soft(result.status, 'Owned offline resources must close')
        .toBe('fulfilled');
  }
});

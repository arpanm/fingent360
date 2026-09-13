import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  FeedSchema,
  MediaAssetSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({
  trace: 'off',
  video: 'off',
  screenshot: 'off',
  contextOptions: { reducedMotion: 'reduce' },
});
test('E2E-WEB-160 reviewed illustration, controlled captions and actual video download @UX-002', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const headers = {
    Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  };
  const feed = FeedSchema.parse(
    await (await page.request.get('/api/v1/discovery/feed?kind=term')).json(),
  );
  const item = feed.items[0];
  expect(
    item,
    'Publish a glossary item before browser media acceptance.',
  ).toBeTruthy();
  await page.request.post('/api/v1/ops/session', {
    headers,
    data: { key: await operatorKey() },
  });
  const existing = await page.request.get(
    `/api/v1/discovery/items/${item!.id}/media`,
  );
  const originallyPublic = existing.status() === 200;
  const asset = MediaAssetSchema.parse(
    await (
      await page.request.post(`/api/v1/ops/media/${item!.id}`, {
        headers,
        data: {},
      })
    ).json(),
  );
  try {
    expect(
      (
        await page.request.put(`/api/v1/ops/media/${item!.id}`, {
          headers,
          data: { assetId: asset.id, publish: true },
        })
      ).status(),
    ).toBe(200);
    await page.goto(`/#read/${item!.id}`);
    const media = page.getByRole('region', { name: 'Reviewed visual summary' });
    await expect(media.getByRole('img')).toBeVisible();
    await expect(
      media.getByRole('button', { name: 'Play captions', exact: true }),
    ).toBeVisible();
    await media
      .getByRole('button', { name: 'Play captions', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(
      media.getByRole('button', { name: 'Pause captions' }),
    ).toBeVisible();
    await media.getByRole('button', { name: 'Pause captions' }).click();
    await media
      .getByText('Read full caption transcript', { exact: true })
      .click();
    await expect(media.getByRole('list')).toContainText(item!.title);
    const supported = await page.evaluate(
      () =>
        typeof MediaRecorder !== 'undefined' &&
        typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
        ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].some(
          (m) => MediaRecorder.isTypeSupported(m),
        ),
    );
    if (supported) {
      const download = page.waitForEvent('download', { timeout: 60000 });
      await media
        .getByRole('button', { name: 'Download caption video' })
        .click();
      const clip = await download;
      expect(clip.suggestedFilename()).toMatch(/\.webm$/);
      const clipPath = `artifacts/ux2-caption-${testInfo.project.name}.webm`;
      await clip.saveAs(clipPath);
      const bytes = await readFile(clipPath);
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
      const dimensions = await page.evaluate(async (encoded) => {
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(
          new Blob([bytes], { type: 'video/webm' }),
        );
        const video = document.createElement('video');
        try {
          return await new Promise<{ width: number; height: number }>(
            (resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Downloaded clip did not decode')),
                15000,
              );
              video.onloadeddata = () => {
                clearTimeout(timer);
                resolve({ width: video.videoWidth, height: video.videoHeight });
              };
              video.onerror = () => {
                clearTimeout(timer);
                reject(new Error('Downloaded clip is not playable'));
              };
              video.src = url;
              video.load();
            },
          );
        } finally {
          video.removeAttribute('src');
          video.load();
          URL.revokeObjectURL(url);
        }
      }, bytes.toString('base64'));
      expect(dimensions).toEqual({ width: 960, height: 640 });
      await expect(media.getByRole('status')).toContainText(
        'Video clip downloaded',
      );
    } else {
      await media
        .getByRole('button', { name: 'Download caption video' })
        .click();
      await expect(media.getByRole('status')).toContainText(
        /cannot export|unavailable/,
      );
    }
  } finally {
    await page.request.put(`/api/v1/ops/media/${item!.id}`, {
      headers,
      data: { assetId: asset.id, publish: originallyPublic },
    });
    await page.request.delete('/api/v1/ops/session', { headers });
  }
});

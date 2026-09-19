import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  FeedItemSchema,
  MediaAssetSchema,
} from '../../../../packages/contracts/src/index';
import { beaBrowserCall } from '../../helpers/bea-fixture';
import { expectCaptionClipPlayback } from '../../helpers/media-playback';

test.use({
  trace: 'off',
  video: 'off',
  screenshot: 'off',
  contextOptions: { reducedMotion: 'reduce' },
});

test('E2E-OFFLINE-160 downloaded template visual captions and actual WebM play without API transport @MEDIA-001', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    feed: unknown[];
    media: Record<string, unknown>;
  };
  const items = bundle.feed.map((item) => FeedItemSchema.parse(item));
  const asset = Object.values(bundle.media)
    .map((value) => MediaAssetSchema.parse(value))
    .find(
      (value) =>
        value.status === 'published' &&
        value.generation.provider === 'template' &&
        !value.image &&
        items.some(
          (item) =>
            item.id === value.itemId &&
            item.version === value.itemVersion &&
            item.kind === 'term',
        ),
    );
  expect(
    asset,
    'The actual downloaded bundle must contain a reviewed template glossary visual.',
  ).toBeTruthy();
  if (!asset)
    throw new Error('No reviewed template visual in the actual bundle.');
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      outgoing.push(request.url());
  });
  await page.goto(`/#read/${asset.itemId}`);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const receipt = await beaBrowserCall(
    page,
    `/api/v1/discovery/items/${asset.itemId}/media`,
  );
  expect(receipt.status).toBe(200);
  expect(MediaAssetSchema.parse(receipt.body)).toEqual(asset);
  const media = page.getByRole('region', {
    name: 'Reviewed visual summary',
    exact: true,
  });
  const illustration = media.getByRole('img');
  await expect(illustration).toBeVisible();
  await expect(illustration).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(media).toContainText(
    `Based on source edition ${asset.itemVersion}`,
  );
  await expect(
    media.getByRole('button', { name: 'Pause captions', exact: true }),
  ).toHaveCount(0);
  const caption = media.locator('.media-caption');
  await expect(caption).toHaveText(asset.captions[0]!.text);
  const play = media.getByRole('button', {
    name: 'Play captions',
    exact: true,
  });
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(caption).not.toHaveText(asset.captions[0]!.text, {
    timeout: asset.captions[0]!.endMs + 5000,
  });
  await media
    .getByRole('button', { name: 'Pause captions', exact: true })
    .press('Enter');
  await media
    .getByText('Read full caption transcript', { exact: true })
    .press('Enter');
  await expect(media.getByRole('listitem')).toHaveText(
    asset.captions.map((entry) => entry.text),
  );
  await expect(
    media.getByRole('link', { name: 'Original source', exact: true }),
  ).toHaveAttribute('href', asset.sourceUrl);
  const supported = await page.evaluate(
    () =>
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].some(
        (mime) => MediaRecorder.isTypeSupported(mime),
      ),
  );
  expect(
    supported,
    'Offline playback acceptance requires the configured Chromium WebM recording capability; unsupported export is a separate fallback, not a playback pass.',
  ).toBe(true);
  const download = page.waitForEvent('download', { timeout: 60000 });
  await media
    .getByRole('button', { name: 'Download caption video', exact: true })
    .press('Enter');
  const clip = await download;
  expect(clip.suggestedFilename()).toBe(
    `${asset.itemId}-v${asset.itemVersion}.webm`,
  );
  const file = testInfo.outputPath('offline-template-caption.webm');
  await clip.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.byteLength).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  await expectCaptionClipPlayback(page, bytes.toString('base64'));
  await expect(media.getByRole('status')).toContainText(
    'Video clip downloaded',
  );
  await page.reload();
  await expect(media.getByRole('img')).toBeVisible();
  await expect(
    media.getByRole('button', { name: 'Play captions', exact: true }),
  ).toBeVisible();
  await expect(
    media.getByRole('button', { name: 'Pause captions', exact: true }),
  ).toHaveCount(0);
  expect(outgoing).toEqual([]);
});

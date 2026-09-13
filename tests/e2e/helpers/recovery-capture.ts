import { expect, type Locator, type Page, type Route } from '@playwright/test';

// Keep the actual crop image inside the browser. Only four non-secret pixel
// samples cross the test boundary; callers disable trace/video/screenshots.
export async function expectRecoveryCaptureMask(page: Page, output: Locator) {
  let uploads = 0;
  const denyUpload = async (route: Route) => {
    if (route.request().method() === 'POST') {
      uploads++;
      await route.abort('blockedbyclient');
    } else await route.fallback();
  };
  await page.route('**/api/v1/feedback', denyUpload);
  try {
    await output.evaluate((element) =>
      element.scrollIntoView({ block: 'center', inline: 'nearest' }),
    );
    await page
      .getByRole('button', { name: 'Give feedback', exact: true })
      .click();
    // Native feedback choices do not replace the underlying page. Measure its
    // real output box immediately before the capture action, without reading it.
    const box = await output.boundingBox();
    expect(
      box,
      'Generated code must have a visible box before capture.',
    ).not.toBeNull();
    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page
      .getByRole('button', { name: 'Screenshot + feedback', exact: true })
      .click();
    const crop = page.getByRole('dialog', { name: 'Select area to capture' });
    const preview = crop.getByRole('img', {
      name: 'App screenshot to crop',
      exact: true,
    });
    await expect(preview).toBeVisible();
    const pixels = await preview.evaluate(
      async (element, geometry) => {
        const image = element as HTMLImageElement;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Capture pixels are unavailable.');
        context.drawImage(image, 0, 0);
        const scaleX = image.naturalWidth / geometry.viewport.width;
        const scaleY = image.naturalHeight / geometry.viewport.height;
        const inset = 8;
        const left = geometry.box.x + inset;
        const right = geometry.box.x + geometry.box.width - inset;
        const top = geometry.box.y + inset;
        const bottom = geometry.box.y + geometry.box.height - inset;
        return [
          [left, top],
          [right, top],
          [left, bottom],
          [right, bottom],
        ].map(([x, y]) =>
          Array.from(
            context.getImageData(
              Math.floor(x! * scaleX),
              Math.floor(y! * scaleY),
              1,
              1,
            ).data,
          ),
        );
      },
      { box: box!, viewport },
    );
    expect(
      pixels,
      'Every corner of the generated code box must contain the opaque privacy mask.',
    ).toEqual(Array.from({ length: 4 }, () => [36, 56, 47, 255]));
    await crop.getByRole('button', { name: 'Cancel', exact: true }).click();
    const composer = page.getByRole('dialog', { name: 'Share feedback' });
    await composer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(composer).toHaveCount(0);
    await expect(output).toBeVisible();
    expect(
      uploads,
      'Capturing and discarding a recovery screenshot must never attempt delivery.',
    ).toBe(0);
  } finally {
    await page.unroute('**/api/v1/feedback', denyUpload);
  }
}

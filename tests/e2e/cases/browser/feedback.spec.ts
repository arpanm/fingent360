import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
const prefix = 'E2E feedback fixture ';
// Project browser channel remains intact; only Chromium's audio test device is enabled.
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

async function open(page: Page, screenshot = false) {
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: screenshot ? 'Screenshot + feedback' : 'Feedback only',
      exact: true,
    })
    .click();
}
async function submit(page: Page, text: string) {
  const dialog = page.getByRole('dialog', { name: 'Share feedback' });
  await dialog.getByLabel('Your feedback', { exact: true }).fill(text);
  await dialog
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await dialog
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Saved on this device' })
    .getByRole('link', { name: 'View feedback', exact: true })
    .click();
  const card = page.getByRole('article').filter({ hasText: text });
  await expect(card.getByText('Received', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  return card;
}
async function cleanup(page: Page, text: string) {
  // Only capabilities belonging to this test's unique submitted text are read.
  const records = await page.evaluate(async (text) => {
    const names = await indexedDB.databases();
    if (!names.some((v) => v.name === 'fingent360-feedback')) return [];
    return new Promise<{ id: string; receiptToken: string }[]>(
      (resolve, reject) => {
        const request = indexedDB.open('fingent360-feedback');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction('outbox', 'readonly');
          const read = tx.objectStore('outbox').get('state');
          read.onsuccess = () => {
            const stored = read.result as
              | {
                  records?: {
                    submission?: {
                      id: string;
                      receiptToken: string;
                      text: string;
                    };
                  }[];
                }
              | undefined;
            resolve(
              (stored?.records ?? [])
                .filter((v) => v.submission?.text === text)
                .map((v) => ({
                  id: v.submission!.id,
                  receiptToken: v.submission!.receiptToken,
                })),
            );
            database.close();
          };
          read.onerror = () => {
            database.close();
            reject(read.error);
          };
        };
      },
    );
  }, text);
  for (const record of records) {
    const result = await page.request.delete(`/api/v1/feedback/${record.id}`, {
      headers: {
        'X-Feedback-Token': record.receiptToken,
        Origin: process.env.E2E_WEB_URL!,
      },
    });
    expect([200, 204, 410]).toContain(result.status());
  }
}

test('E2E-WEB-190 real screenshot crop and cover reaches server receipt and durable deletion @FEEDBACK-001', async ({
  page,
}) => {
  test.setTimeout(90000);
  const text = `${prefix}${randomUUID()} screenshot`;
  await page.goto('/#today');
  await expect(
    page.getByRole('heading', { name: /A little wiser/ }),
  ).toBeVisible();
  try {
    await open(page, true);
    const crop = page.getByRole('dialog', { name: 'Select area to capture' });
    await expect(
      crop.getByRole('img', { name: 'App screenshot to crop' }),
    ).toBeVisible();
    await crop.getByText('Adjust crop with keyboard', { exact: true }).click();
    const width = crop.getByRole('slider', { name: 'Crop width', exact: true });
    await width.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await expect(width).toHaveValue('99');
    await crop
      .getByRole('button', { name: 'Cover private details', exact: true })
      .click();
    const image = crop.locator('.feedback-crop-image');
    await image.scrollIntoViewIfNeeded();
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(
      crop.getByRole('button', { name: 'Undo cover', exact: true }),
    ).toBeVisible();
    await crop
      .getByRole('button', { name: 'Use screenshot', exact: true })
      .click();
    const composer = page.getByRole('dialog', { name: 'Share feedback' });
    const attached = composer.getByRole('img', {
      name: 'Screenshot attached to your feedback',
    });
    await expect(attached).toBeVisible();
    const covered = await attached.evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return [
        ...context.getImageData(
          Math.floor(canvas.width * 0.45),
          Math.floor(canvas.height * 0.4),
          1,
          1,
        ).data,
      ];
    });
    expect(covered).toEqual([22, 42, 33, 255]);
    const card = await submit(page, text);
    await card
      .getByRole('button', { name: 'View attachments & details', exact: true })
      .click();
    await expect(
      card.getByRole('img', { name: 'Submitted screenshot' }),
    ).toBeVisible();
    await page.reload();
    const persisted = page.getByRole('article').filter({ hasText: text });
    await expect(
      persisted.getByText('Received', { exact: true }),
    ).toBeVisible();
    await persisted
      .getByRole('button', { name: 'Delete feedback', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete this feedback?' })
      .getByRole('button', { name: 'Confirm deletion', exact: true })
      .click();
    await expect(
      page.getByRole('article').filter({ hasText: text }),
    ).toHaveCount(0, { timeout: 30000 });
  } finally {
    await cleanup(page, text);
  }
});

test('E2E-WEB-191 feedback choices Escape crop retake and discard preserve deliberate draft state @FEEDBACK-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/#today');
  const trigger = page.getByRole('button', {
    name: 'Give feedback',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Choose feedback type' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Choose feedback type' }),
  ).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goto('/#explore');
  await page.locator('a[href="#today"]:visible').first().click();
  await expect(page).toHaveURL(/#today/);
  await trigger.click();
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'Choose feedback type' }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/#today/);
  await open(page);
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer
    .getByLabel('Your feedback', { exact: true })
    .fill('Unsubmitted retake fixture');
  await composer
    .getByRole('button', { name: 'Add a screenshot', exact: true })
    .click();
  let crop = page.getByRole('dialog', { name: 'Select area to capture' });
  await expect(crop).toBeVisible();
  await crop.getByRole('button', { name: 'Retake', exact: true }).click();
  crop = page.getByRole('dialog', { name: 'Select area to capture' });
  await expect(crop).toBeVisible();
  await crop
    .getByRole('button', { name: 'Use screenshot', exact: true })
    .click();
  await expect(
    composer.getByLabel('Your feedback', { exact: true }),
  ).toHaveValue('Unsubmitted retake fixture');
  await composer
    .getByRole('button', { name: 'Retake screenshot', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Select area to capture' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(
    composer.getByLabel('Your feedback', { exact: true }),
  ).toHaveValue('Unsubmitted retake fixture');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', {
    name: 'Discard this feedback draft?',
  });
  await expect(discard).toBeVisible();
  await page.goBack();
  await expect(discard).toHaveCount(0);
  await expect(page).toHaveURL(/#today/);
  await expect(
    composer.getByLabel('Your feedback', { exact: true }),
  ).toHaveValue('Unsubmitted retake fixture');
  await composer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(discard).toBeVisible();
  await discard
    .getByRole('button', { name: 'Keep editing', exact: true })
    .click();
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await expect(trigger).toBeVisible();
});

test.describe('Simulated microphone device, real MediaRecorder and feedback API', () => {
  test('E2E-WEB-192 recorded synthetic audio is playable and receives actual server acknowledgment @FEEDBACK-001 @simulated', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const text = `${prefix}${randomUUID()} synthetic audio`;
    await page.goto('/#today');
    try {
      await open(page);
      const composer = page.getByRole('dialog', { name: 'Share feedback' });
      await composer
        .getByRole('button', { name: /Record voice feedback/ })
        .click();
      await expect(composer.getByRole('status')).toContainText(
        'Recording 0:01',
        { timeout: 10000 },
      );
      await composer
        .getByRole('button', { name: 'Stop recording', exact: true })
        .click();
      const audio = composer.getByLabel('Recorded feedback', { exact: true });
      await expect(audio).toBeVisible();
      await expect
        .poll(() => audio.evaluate((e) => (e as HTMLAudioElement).readyState))
        .toBeGreaterThan(0);
      await audio.evaluate((e) => (e as HTMLAudioElement).play());
      await expect
        .poll(() => audio.evaluate((e) => (e as HTMLAudioElement).currentTime))
        .toBeGreaterThan(0);
      await audio.evaluate((e) => (e as HTMLAudioElement).pause());
      const card = await submit(page, text);
      await card
        .getByRole('button', {
          name: 'View attachments & details',
          exact: true,
        })
        .click();
      await expect(
        card.getByLabel('Submitted voice feedback', { exact: true }),
      ).toBeVisible();
      await card
        .getByRole('button', { name: 'Delete feedback', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Confirm deletion', exact: true })
        .click();
      await expect(
        page.getByRole('article').filter({ hasText: text }),
      ).toHaveCount(0, { timeout: 30000 });
    } finally {
      await cleanup(page, text);
    }
  });
});

test('E2E-WEB-193 simulated microphone denial keeps text feedback usable without submitting @FEEDBACK-001 @simulated', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException(
        'Synthetic test permission denial',
        'NotAllowedError',
      );
    };
  });
  await page.goto('/#today');
  await open(page);
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer.getByRole('button', { name: /Record voice feedback/ }).click();
  await expect(composer.getByRole('alert')).toBeVisible();
  await composer
    .getByLabel('Your feedback', { exact: true })
    .fill('Unsubmitted denial fallback fixture');
  await composer
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await expect(
    composer.getByRole('button', { name: 'Submit feedback', exact: true }),
  ).toBeEnabled();
  await composer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
});

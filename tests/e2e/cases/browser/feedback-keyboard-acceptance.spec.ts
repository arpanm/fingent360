import { randomUUID } from 'node:crypto';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, expectReceived } from '../../helpers/feedback-fixture';
import { operatorKey } from '../../helpers/operator';
import { FeedbackReceiptSchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let count = 0; count < 120; count++) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      await expect(target).toBeFocused();
      // Native keyboard scrolling must keep the active control exposed; do not
      // repair an obstruction by forcing focus or programmatic scrolling.
      expect(
        await target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const x = rect.x + rect.width / 2,
            y = rect.y + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth + 1 &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight + 1 &&
            !!hit &&
            (hit === element || element.contains(hit))
          );
        }),
      ).toBe(true);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw Error(
    'The requested feedback control was not reachable through sequential Tab navigation.',
  );
}
async function activate(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}
async function evidence(
  page: Page,
  region: Locator,
  info: TestInfo,
  label: string,
) {
  expect(
    await region.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.right <= innerWidth + 1 &&
        element.scrollWidth <= element.clientWidth + 2
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const path = info.outputPath('1127-synthetic-feedback-' + label + '.png');
  await page.screenshot({ path });
  await info.attach('1127 synthetic feedback ' + label, {
    path,
    contentType: 'image/png',
  });
}

test('E2E-WEB-1127 keyboard consent crop review history status and deletion retain exposed controls at narrow width @FEEDBACK-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 800 });
  const text = 'TEST-SIMULATION keyboard feedback ' + randomUUID();
  // The only screenshot subject is this clean feedback page and this synthetic
  // report. No account, private portfolio, operator credential or token is shown.
  await page.goto('/#feedback');
  await expect(
    page.getByRole('heading', { name: 'Your feedback', exact: true }),
  ).toBeVisible();
  const launcher = page.getByRole('button', {
    name: 'Give feedback',
    exact: true,
  });
  await launcher.focus(); // One initial keyboard entry point; every following control uses Tab.
  await page.keyboard.press('Enter');
  await activate(
    page,
    page.getByRole('button', { name: 'Screenshot + feedback', exact: true }),
  );
  const crop = page.getByRole('dialog', { name: 'Select area to capture' });
  await expect(
    crop.getByRole('img', { name: 'App screenshot to crop' }),
  ).toBeVisible();
  await activate(
    page,
    crop.locator('summary').filter({ hasText: 'Adjust crop with keyboard' }),
  );
  const width = crop.getByRole('slider', { name: 'Crop width', exact: true });
  await tabTo(page, width);
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await expect(width).toHaveValue('99');
  await evidence(page, crop, info, 'crop');
  await activate(
    page,
    crop.getByRole('button', { name: 'Use screenshot', exact: true }),
  );
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await expect(
    composer.getByRole('img', { name: 'Screenshot attached to your feedback' }),
  ).toBeVisible();
  const input = composer.getByLabel('Your feedback', { exact: true });
  await tabTo(page, input);
  await page.keyboard.insertText(text);
  const submit = composer.getByRole('button', {
    name: 'Submit feedback',
    exact: true,
  });
  await expect(submit).toBeDisabled();
  const consent = composer.getByLabel(
    'Send this feedback and its attachments to the feedback team.',
    { exact: true },
  );
  await tabTo(page, consent);
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
  await expect(submit).toBeEnabled();
  await tabTo(page, submit);
  await evidence(page, composer, info, 'composer');
  const delivered = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/feedback' &&
      response.request().postDataJSON()?.text === text,
  );
  await page.keyboard.press('Enter');
  const response = await delivered;
  expect(response.status()).toBe(201);
  const receipt = FeedbackReceiptSchema.parse(await response.json());
  await activate(
    page,
    page
      .getByRole('dialog', { name: 'Saved on this device' })
      .getByRole('link', { name: 'View feedback', exact: true }),
  );
  const card = page.getByRole('article').filter({ hasText: text });
  await expectReceived(card);
  await activate(
    page,
    card.getByRole('button', {
      name: 'View attachments & details',
      exact: true,
    }),
  );
  await expect(
    card.getByRole('img', { name: 'Submitted screenshot' }),
  ).toBeVisible();
  await expect(
    card.getByRole('region', { name: 'Support access history' }),
  ).toBeVisible();
  await evidence(page, card, info, 'history');

  // Authenticated setup uses the real API; review and status mutation use only
  // the application's keyboard controls, without exposing the bootstrap key.
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#ops');
  await activate(
    page,
    page.getByRole('button', { name: 'Feedback inbox', exact: true }),
  );
  const inbox = page.getByRole('region', { name: 'Feedback inbox' });
  const row = inbox.getByRole('article').filter({ hasText: text });
  const reviewButton = row.getByRole('button', {
    name: 'Review feedback ' + receipt.id.slice(0, 8),
    exact: true,
  });
  await tabTo(page, reviewButton);
  await evidence(page, inbox, info, 'inbox');
  await page.keyboard.press('Enter');
  const review = page.getByRole('dialog', {
    name: 'Review feedback',
    exact: true,
  });
  const status = review.getByLabel('Review status', { exact: true });
  await tabTo(page, status);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(status).toHaveValue('reviewing');
  await activate(
    page,
    review.getByRole('button', { name: 'Save review status', exact: true }),
  );
  await expect(
    review.getByText('Feedback status saved.', { exact: true }),
  ).toBeVisible();
  await activate(
    page,
    review.getByRole('button', { name: 'Close', exact: true }),
  );
  await expect(reviewButton).toBeFocused();
  await page.goto('/#feedback');
  await activate(
    page,
    page.getByRole('button', { name: 'Check delivery', exact: true }),
  );
  await expect(card.getByText('Being reviewed', { exact: true })).toBeVisible();
  const remove = card.getByRole('button', {
    name: 'Delete feedback',
    exact: true,
  });
  await activate(page, remove);
  await expect(
    page.getByRole('dialog', { name: 'Delete this feedback?' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(remove).toBeFocused();
  await page.keyboard.press('Enter');
  const deletion = page.waitForResponse(
    (result) =>
      result.request().method() === 'DELETE' &&
      new URL(result.url()).pathname === '/api/v1/feedback/' + receipt.id,
  );
  await activate(
    page,
    page
      .getByRole('dialog', { name: 'Delete this feedback?' })
      .getByRole('button', { name: 'Confirm deletion', exact: true }),
  );
  expect((await deletion).ok()).toBe(true);
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your feedback', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(
    0,
  );
  // The normal fixture teardown removes only this test's isolated API storage.
  expect(feedbackSandbox.schema).toMatch(/^e2e_feedback_/);
});

import { randomUUID } from 'node:crypto';
import { test, expect, expectReceived } from '../../helpers/feedback-fixture';
import { operatorKey } from '../../helpers/operator';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-1251 support access history refreshes from actual reads and survives offline device storage @DEV-017', async ({
  page,
  request,
  context,
}) => {
  const text = `Synthetic support history ${randomUUID()}`;
  await page.goto('/#today');
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
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
  await expectReceived(card);
  const origin = process.env.E2E_WEB_URL || 'http://localhost:5173';
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: { Origin: origin },
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/v1/ops/feedback')).status()).toBe(200);
  await page
    .getByRole('button', { name: 'Check delivery', exact: true })
    .click();
  await card
    .getByRole('button', { name: 'View attachments & details', exact: true })
    .click();
  const history = card.getByRole('region', { name: 'Support access history' });
  await expect(history).toContainText('1 recorded support accesses.');
  await expect(history).toContainText(
    'Administrator opened the inbox containing your feedback',
  );
  await page.reload();
  await card
    .getByRole('button', { name: 'View attachments & details', exact: true })
    .click();
  await context.setOffline(true);
  await expect(history).toContainText('1 recorded support accesses.');
  await expect(history).toContainText('Saved on this device');
  await context.setOffline(false);
});

import { test, expect } from '../../helpers/app-fixture';
import {
  whatsappAccount,
  whatsappSource,
  postWhatsappWebhook,
  inboundWhatsapp,
  syntheticPhone,
} from '../../helpers/whatsapp-channel';
test.use({ whatsappSimulation: true });
test('E2E-WEB-1600 actual consent form recipient verification public selection queue and disconnect @DEV-029 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  const state = await request.storageState();
  const session = state.cookies.find(
    (cookie) => cookie.name === 'f360_session',
  );
  if (!session)
    throw Error('Verified WhatsApp fixture requires an account session.');
  const origin = new URL(baseURL!);
  // Cookie headers in route.continue cannot authenticate a browser. Install the
  // real owner session in its cookie jar, preserving the account-only path.
  await page.context().addCookies([
    {
      ...session,
      domain: origin.hostname,
      secure: origin.protocol === 'https:',
    },
  ]);
  await page.goto('/#whatsapp');
  const panel = page.getByRole('main', { name: 'WhatsApp summaries' });
  await expect(panel).toContainText('Not connected');
  await panel
    .getByLabel('Your WhatsApp number, including country code')
    .fill(syntheticPhone);
  await expect(
    panel.getByRole('button', { name: 'Verify my number' }),
  ).toBeDisabled();
  await panel
    .getByRole('checkbox', {
      name: 'I consent to receiving the public summaries I explicitly request on WhatsApp. I can disconnect or send STOP at any time.',
      exact: true,
    })
    .check();
  await panel.getByRole('button', { name: 'Verify my number' }).click();
  const link = panel.getByRole('link', {
    name: 'Open WhatsApp and send verification',
  });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute('href'))!);
  expect(url.hostname).toBe('wa.me');
  // No external message is sent. Deliver a clearly synthetic, signed inbound challenge to the actual API.
  expect(
    (
      await postWhatsappWebhook(
        request,
        inboundWhatsapp(url.searchParams.get('text')!),
      )
    ).status(),
  ).toBe(200);
  await panel.getByRole('button', { name: 'Refresh WhatsApp status' }).click();
  await expect(panel).toContainText('verified');
  await expect(link).toHaveCount(0);
  await panel
    .getByRole('combobox', { name: 'Reviewed public summary', exact: true })
    .selectOption(source.id);
  await expect(
    panel.getByRole('link', { name: 'Read evidence first' }),
  ).toHaveAttribute('href', '#read/' + source.id);
  await panel.getByRole('button', { name: 'Request this summary' }).click();
  await expect(panel.getByRole('listitem')).toContainText('queued');
  await panel
    .getByRole('button', {
      name: 'Disconnect WhatsApp and cancel queued messages',
    })
    .click();
  await expect(panel.getByRole('listitem')).toContainText('cancelled');
  await expect(panel).toContainText('disabled');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.getByRole('link', { name: 'Back to Today' }).click();
  await expect(page).toHaveURL(/#today$/);
});

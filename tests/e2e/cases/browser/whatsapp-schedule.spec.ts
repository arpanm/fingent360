import { test, expect } from '../../helpers/app-fixture';
import {
  whatsappAccount,
  verifyWhatsapp,
} from '../../helpers/whatsapp-channel';
test.use({ whatsappSimulation: true });
test('E2E-WEB-1690 actual recurring consent schedule save pause resume and delete @DEV-029 @TEST-SIMULATION', async ({
  page,
  request,
  baseURL,
}) => {
  await whatsappAccount(request);
  await verifyWhatsapp(request);
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
  const panel = page.getByRole('region', {
    name: 'Recurring WhatsApp summaries',
  });
  await expect(panel).toContainText('Not saved');
  await panel
    .getByRole('checkbox', { name: 'Learning glossary', exact: true })
    .check();
  await panel.getByLabel('Local delivery time').fill('10:15');
  await panel.getByLabel('IANA timezone').fill('Asia/Kolkata');
  const consent = panel.getByRole('checkbox', {
    name: 'I consent to this recurring public-summary schedule on my verified WhatsApp number.',
  });
  await expect(
    panel.getByRole('button', { name: 'Save recurring schedule' }),
  ).toBeDisabled();
  await consent.check();
  await panel.getByLabel('Maximum summaries').fill('2');
  await expect(consent).not.toBeChecked();
  await consent.check();
  await panel.getByRole('button', { name: 'Save recurring schedule' }).click();
  await expect(panel).toContainText('Schedule: active');
  await panel
    .getByRole('button', { name: 'Pause recurring summaries' })
    .click();
  await expect(panel).toContainText('Schedule: paused');
  await expect(
    panel.getByRole('button', { name: 'Resume recurring summaries' }),
  ).toBeDisabled();
  await consent.check();
  await panel
    .getByRole('button', { name: 'Resume recurring summaries' })
    .click();
  await expect(panel).toContainText('Schedule: active');
  await panel
    .getByRole('button', { name: 'Delete recurring schedule' })
    .click();
  await expect(panel).toContainText('Schedule: deleted');
  await page.reload();
  await expect(panel).toContainText('Schedule: deleted');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { seedReadingCalendar } from '../../helpers/reading-calendar';
test('E2E-WEB-1881 saved source follows show planned cancellation and open full calendar @DEV-018 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedReadingCalendar(feedbackSandbox);
  await page.goto('/#reading-follow');
  const setup = await page.evaluate(
    async ({ username }) => {
      const send = async (path: string, body: unknown, method = 'POST') =>
        (
          await fetch('/api/v1' + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status;
      const registered = await send('/account/register', {
        username,
        password: 'Synthetic-calendar-2026',
        consent: true,
      });
      const saved = await send(
        '/account/reading-follow',
        {
          requestId: crypto.randomUUID(),
          expectedVersion: 0,
          sources: ['bea-gdp-original'],
          topics: [],
          muted: false,
          consent: true,
        },
        'PUT',
      );
      return { registered, saved };
    },
    { username: 'calendar_' + randomUUID().slice(0, 10) },
  );
  expect(setup).toEqual({ registered: 201, saved: 200 });
  await page.reload();
  const section = page.getByRole('region', { name: 'Reading release context' });
  await expect(section).toContainText('Cancelled');
  await expect(section).not.toContainText('International trade');
  await expect(section).toContainText('not a released observation');
  await section.getByText('Calendar provenance', { exact: true }).click();
  await expect(section).toContainText('synthetic-gdp');
  await section.getByRole('link', { name: 'Open release calendars' }).click();
  await expect(page).toHaveURL(/#research-calendar$/);
});

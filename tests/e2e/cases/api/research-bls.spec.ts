import { test, expect } from '../../helpers/app-fixture';
import { seedBlsCalendar } from '../../helpers/research-bls';
import { seedResearchCalendar } from '../../helpers/research-auto';
import { ReleaseCalendarSchema } from '../../../../packages/contracts/src/index';
test('E2E-API-1070 BLS captures isolate source history and retain actual changed release times @RESEARCH-AUTO-002 @BLS-CALENDAR-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const hashes = await seedBlsCalendar(feedbackSandbox);
  const bea = await seedResearchCalendar(feedbackSandbox);
  const current = ReleaseCalendarSchema.parse(
    await (
      await request.get('/api/v1/research-calendar?source=bls-calendar')
    ).json(),
  );
  expect(current.sourceId).toBe('bls-calendar');
  expect(current.editions).toHaveLength(2);
  expect(current.edition).toBe(hashes[1]);
  expect(current.events[0]?.scheduledAt).toBe('2027-01-05T14:30:00.000Z');
  const old = ReleaseCalendarSchema.parse(
    await (
      await request.get(
        `/api/v1/research-calendar?source=bls-calendar&edition=${hashes[0]}`,
      )
    ).json(),
  );
  expect(old.events[0]?.scheduledAt).toBe('2027-01-05T13:30:00.000Z');
  expect(old.events[0]?.sequence).toBe(1);
  expect(
    (
      await request.get(
        `/api/v1/research-calendar?source=bea-calendar&edition=${hashes[0]}`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (await request.get('/api/v1/research-calendar?source=untrusted')).status(),
  ).toBe(400);
  expect(
    ReleaseCalendarSchema.parse(
      await (await request.get('/api/v1/research-calendar')).json(),
    ).edition,
  ).toBe(bea);
});

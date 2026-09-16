import { test, expect } from '../../helpers/feedback-fixture';
import { rbiCalendarFixture, rbiShape } from '../../helpers/rbi-calendar';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { automaticPublicationConfig } from '../../helpers/research-auto-publication';
import {
  RbiCalendarSchema,
  parseRbiCalendar,
} from '../../../../packages/contracts/src/rbi-calendar';
test('E2E-API-1550 retained actual RBI schedule preserves original date captured editions and raw evidence @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await rbiCalendarFixture(feedbackSandbox),
    response = await request.get(
      '/api/v1/research-calendar/rbi?edition=' + first,
    );
  expect(response.status(), await response.text()).toBe(200);
  const saved = RbiCalendarSchema.parse(await response.json());
  expect(saved.data?.meetings).toHaveLength(6);
  expect(saved.data?.meetings[0]).toMatchObject({
    startOn: '2026-04-06',
    endOn: '2026-04-08',
    precision: 'day',
  });
  const second = await rbiCalendarFixture(
    feedbackSandbox,
    rbiShape + '<!-- synthetic retained revision -->',
    '2026-09-16T00:00:00.000Z',
  );
  expect(second).not.toBe(first);
  expect(
    (await (await request.get('/api/v1/research-calendar/rbi')).json()).edition,
  ).toBe(second);
  expect(
    (
      await (
        await request.get('/api/v1/research-calendar/rbi?edition=' + first)
      ).json()
    ).data,
  ).toEqual(saved.data);
  const pool = await connectionDatabase(feedbackSandbox),
    { mongo } = await automaticPublicationConfig(feedbackSandbox);
  try {
    expect(
      (await mongo.db().collection('rbi_calendar_raw').findOne({ _id: first }))
        ?.body,
    ).toBe(rbiShape);
    await expect(
      pool.query('DELETE FROM rbi_calendar_editions WHERE hash=$1', [first]),
    ).rejects.toThrow();
    const { captureRbiCalendar } = await import(
      new URL('../../../../apps/api/dist/rbi-calendar.js', import.meta.url).href
    );
    await expect(captureRbiCalendar(pool, mongo)).rejects.toThrow('permission');
  } finally {
    await Promise.allSettled([pool.end(), mongo.close()]);
  }
});
test('E2E-API-1551 RBI malformed date metadata and duplicate rows fail without replacing good capture @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await rbiCalendarFixture(feedbackSandbox);
  for (const bad of [
    rbiShape.replace('April 6, 7 and 8', 'April 6, 8 and 9'),
    rbiShape.replace('Date : Mar 23', 'Date : Mar 24'),
    rbiShape.replace('February 3, 4 and 5, 2027', 'February 3, 4 and 5, 2028'),
    '<script>' + rbiShape + '</script>',
  ])
    expect(() => parseRbiCalendar(bad)).toThrow();
  await expect(
    rbiCalendarFixture(
      feedbackSandbox,
      rbiShape.replace('April 6, 7 and 8', 'TBD'),
    ),
  ).rejects.toThrow();
  expect(
    (await (await request.get('/api/v1/research-calendar/rbi')).json()).edition,
  ).toBe(first);
});

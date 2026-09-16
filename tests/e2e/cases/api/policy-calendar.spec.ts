import { test, expect } from '../../helpers/feedback-fixture';
import {
  policyCalendarFixture,
  fomcShape,
} from '../../helpers/policy-calendar';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { automaticPublicationConfig } from '../../helpers/research-auto-publication';
import {
  PolicyCalendarSchema,
  parseFomcCalendar,
} from '../../../../packages/contracts/src/policy-calendar';

test('E2E-API-1440 actual calendar retention preserves day precision statement admission and separate captured editions @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await policyCalendarFixture(feedbackSandbox);
  const reply = await request.get(
    '/api/v1/research-calendar/policy?edition=' + first,
  );
  expect(reply.status(), await reply.text()).toBe(200);
  const calendar = PolicyCalendarSchema.parse(await reply.json());
  expect(
    calendar.meetings.find((item) => item.endOn === '2024-05-01'),
  ).toMatchObject({
    startOn: '2024-04-30',
    precision: 'day',
    status: 'statement-linked',
  });
  expect(
    calendar.meetings.find((item) => item.endOn === '2025-08-22')?.kind,
  ).toBe('notation-vote');
  expect(
    calendar.meetings.find((item) => item.endOn === '2026-09-16'),
  ).toMatchObject({
    projectionsScheduled: true,
    statementUrl: null,
    status: 'scheduled',
  });
  const second = await policyCalendarFixture(
    feedbackSandbox,
    (await fomcShape()).replace('15-16*', '16-17*'),
    '2026-09-16T00:00:00.000Z',
  );
  expect(second).not.toBe(first);
  expect(
    PolicyCalendarSchema.parse(
      await (await request.get('/api/v1/research-calendar/policy')).json(),
    ).edition,
  ).toBe(second);
  expect(
    PolicyCalendarSchema.parse(
      await (
        await request.get('/api/v1/research-calendar/policy?edition=' + first)
      ).json(),
    ).meetings,
  ).toEqual(calendar.meetings);
  const pool = await connectionDatabase(feedbackSandbox),
    { mongo } = await automaticPublicationConfig(feedbackSandbox);
  try {
    expect(
      (
        await mongo
          .db()
          .collection('policy_calendar_raw')
          .findOne({ _id: first })
      )?.body,
    ).toBe(await fomcShape());
    await expect(
      pool.query('DELETE FROM policy_calendar_editions WHERE hash=$1', [first]),
    ).rejects.toThrow();
  } finally {
    await Promise.allSettled([pool.end(), mongo.close()]);
  }
  expect(
    (
      await request.get('/api/v1/research-calendar/policy?edition=bad')
    ).status(),
  ).toBe(400);
});

test('E2E-API-1441 malformed policy dates mismatched statements and duplicate meetings fail without replacing retained capture @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const hash = await policyCalendarFixture(feedbackSandbox),
    source = await fomcShape();
  for (const bad of [
    source.replace('27-28', '27-32'),
    source.replace('monetary20260128a.htm', 'monetary20260129a.htm'),
    source.replace('15-16*', 'TBD'),
    source + source,
  ])
    expect(() => parseFomcCalendar(bad)).toThrow();
  await expect(
    policyCalendarFixture(feedbackSandbox, source.replace('15-16*', 'TBD')),
  ).rejects.toThrow();
  expect(
    PolicyCalendarSchema.parse(
      await (await request.get('/api/v1/research-calendar/policy')).json(),
    ).edition,
  ).toBe(hash);
});

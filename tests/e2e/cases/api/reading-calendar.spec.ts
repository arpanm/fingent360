import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  connectionHeaders as headers,
  seedConnectionSource,
} from '../../helpers/research-connection-fixture';
import { seedReadingCalendar } from '../../helpers/reading-calendar';
import { ReadingFollowViewSchema } from '../../../../packages/contracts/src/index';
test('E2E-API-1880 exact source calendar context preserves cancellation without creating reading notices @DEV-018 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const topic = source.topics[0];
  if (!topic) throw Error('Published source fixture requires an actual topic.');
  const calendar = await seedReadingCalendar(feedbackSandbox),
    base = '/api/v1/account/reading-follow';
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: {
          username: 'calendar_' + randomUUID().slice(0, 10),
          password: 'Synthetic-calendar-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  const save = async (
    version: number,
    sources: string[],
    topics: string[] = [],
    muted = false,
  ) => {
    expect(
      (
        await request.put(base, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: version,
            sources,
            topics,
            muted,
            consent: true,
          },
        })
      ).status(),
    ).toBe(200);
    return ReadingFollowViewSchema.parse(
      await (await request.get(base)).json(),
    );
  };
  let view = await save(0, ['bea-gdp-original']);
  expect(view.calendarContext).toMatchObject({
    state: 'available',
    edition: calendar.edition,
    urgency: 'none',
    createsNotice: false,
  });
  expect(view.calendarContext?.events).toEqual([calendar.events[0]]);
  expect(view.items).toEqual([]);
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { requestId: randomUUID(), expectedVersion: 1 },
      })
    ).status(),
  ).toBe(201);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json()).items,
  ).toEqual([]);
  view = await save(1, ['bea']);
  expect(view.calendarContext?.events).toHaveLength(2);
  view = await save(2, ['bea-gdp-history']);
  expect(view.calendarContext?.state).toBe('not-selected');
  view = await save(3, ['bea'], [], true);
  expect(view.calendarContext).toMatchObject({
    state: 'muted',
    events: [],
    edition: null,
  });
  // Topic-only follows must use an actually published source topic.
  view = await save(4, [], [topic]);
  expect(view.calendarContext?.state).toBe('not-selected');
});

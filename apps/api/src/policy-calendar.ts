import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { MongoClient } from 'mongodb';
import { BadRequestException } from '@nestjs/common';
import {
  FOMC_CALENDAR_URL,
  PolicyCalendarSchema,
  parseFomcCalendar,
} from '@fingent360/contracts';

export async function capturePolicyCalendar(pool: pg.Pool, mongo: MongoClient) {
  const response = await fetch(FOMC_CALENDAR_URL, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Fingent360/1.0 public calendar reader',
      Accept: 'text/html',
    },
  });
  if (!response.ok) throw Error('FOMC calendar source unavailable.');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Empty FOMC calendar.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 2000000) throw Error('FOMC calendar exceeds size limit.');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return retainPolicyCalendar(
    pool,
    mongo,
    Buffer.concat(chunks).toString('utf8'),
    new Date().toISOString(),
  );
}

/** Capture first, parse second: failed source layouts retain their original bytes. */
export async function retainPolicyCalendar(
  pool: pg.Pool,
  mongo: MongoClient,
  body: string,
  retrievedAt: string,
) {
  const hash = createHash('sha256')
    .update(`${FOMC_CALENDAR_URL}\n${body}`)
    .digest('hex');
  await mongo
    .db()
    .collection<{
      _id: string;
      body: string;
      url: string;
      retrievedAt: string;
    }>('policy_calendar_raw')
    .updateOne(
      { _id: hash },
      { $setOnInsert: { body, url: FOMC_CALENDAR_URL, retrievedAt } },
      { upsert: true },
    );
  const meetings = parseFomcCalendar(body);
  await pool.query(
    "INSERT INTO policy_calendar_editions(hash,source_id,retrieved_at,data) VALUES($1,'fomc-calendar',$2,$3::jsonb) ON CONFLICT DO NOTHING",
    [hash, retrievedAt, JSON.stringify(meetings)],
  );
  return hash;
}

export async function readPolicyCalendar(pool: pg.Pool, edition?: string) {
  if (edition !== undefined && !/^[a-f0-9]{64}$/.test(edition))
    throw new BadRequestException('Invalid policy calendar edition.');
  const rows = (
    await pool.query<{ hash: string; retrieved_at: Date }>(
      "SELECT hash,retrieved_at FROM policy_calendar_editions WHERE source_id='fomc-calendar' ORDER BY retrieved_at DESC,hash LIMIT 100",
    )
  ).rows;
  const hash = edition ?? rows[0]?.hash;
  const selected = hash
    ? (
        await pool.query<{ data: unknown; retrieved_at: Date }>(
          "SELECT data,retrieved_at FROM policy_calendar_editions WHERE hash=$1 AND source_id='fomc-calendar'",
          [hash],
        )
      ).rows[0]
    : undefined;
  if (edition && !selected)
    throw new BadRequestException('Policy calendar edition unavailable.');
  return PolicyCalendarSchema.parse({
    sourceId: 'fomc-calendar',
    sourceUrl: FOMC_CALENDAR_URL,
    version: 'fomc-calendar-html-v1',
    edition: hash ?? null,
    retrievedAt: selected?.retrieved_at.toISOString() ?? null,
    basis: 'retained-calendar-capture',
    meetings: selected?.data ?? [],
    editions: rows.map((row) => ({
      edition: row.hash,
      retrievedAt: row.retrieved_at.toISOString(),
    })),
  });
}

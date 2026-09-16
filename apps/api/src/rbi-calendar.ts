import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { MongoClient } from 'mongodb';
import { BadRequestException } from '@nestjs/common';
import {
  RBI_CALENDAR_URL,
  RbiCalendarSchema,
  parseRbiCalendar,
} from '@fingent360/contracts';
export async function retainRbiCalendar(
  pool: pg.Pool,
  mongo: MongoClient,
  body: string,
  retrievedAt: string,
  rightsEvidence: string,
) {
  if (rightsEvidence.trim().length < 20 || rightsEvidence.length > 2000)
    throw Error(
      'RBI caching, display, linking and offline permission evidence is required.',
    );
  const hash = createHash('sha256')
    .update(`${RBI_CALENDAR_URL}\n${body}`)
    .digest('hex');
  await mongo
    .db()
    .collection<{
      _id: string;
      body: string;
      url: string;
      retrievedAt: string;
      rightsEvidence: string;
    }>('rbi_calendar_raw')
    .updateOne(
      { _id: hash },
      {
        $setOnInsert: {
          body,
          url: RBI_CALENDAR_URL,
          retrievedAt,
          rightsEvidence,
        },
      },
      { upsert: true },
    );
  const data = parseRbiCalendar(body);
  RbiCalendarSchema.parse({
    sourceId: 'rbi-mpc-calendar',
    sourceUrl: RBI_CALENDAR_URL,
    version: 'rbi-mpc-html-v1',
    edition: hash,
    retrievedAt,
    data,
    editions: [],
  });
  await pool.query(
    'INSERT INTO rbi_calendar_editions(hash,retrieved_at,rights_evidence,data) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',
    [hash, retrievedAt, rightsEvidence, JSON.stringify(data)],
  );
  return hash;
}
export async function captureRbiCalendar(pool: pg.Pool, mongo: MongoClient) {
  const rights = (
    await pool.query<{ evidence: string }>(
      'SELECT evidence FROM rbi_calendar_rights WHERE id=true',
    )
  ).rows[0];
  if (!rights)
    throw Error(
      'RBI acquisition requires documented permission for caching, display, internal links and offline distribution.',
    );
  const response = await fetch(RBI_CALENDAR_URL, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Fingent360/1.0 permitted calendar reader',
      Accept: 'text/html',
    },
  });
  if (!response.ok) throw Error('RBI calendar original unavailable.');
  const reader = response.body?.getReader();
  if (!reader) throw Error('RBI original is empty.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2000000) throw Error('RBI original exceeds source limit.');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return retainRbiCalendar(
    pool,
    mongo,
    Buffer.concat(chunks).toString('utf8'),
    new Date().toISOString(),
    rights.evidence,
  );
}
export async function readRbiCalendar(pool: pg.Pool, edition?: string) {
  if (edition !== undefined && !/^[a-f0-9]{64}$/.test(edition))
    throw new BadRequestException('Invalid RBI calendar edition.');
  const rows = (
    await pool.query<{ hash: string; retrieved_at: Date }>(
      'SELECT hash,retrieved_at FROM rbi_calendar_editions ORDER BY retrieved_at DESC,hash LIMIT 100',
    )
  ).rows;
  const hash = edition ?? rows[0]?.hash;
  const chosen = hash
    ? (
        await pool.query<{ data: unknown; retrieved_at: Date }>(
          'SELECT data,retrieved_at FROM rbi_calendar_editions WHERE hash=$1',
          [hash],
        )
      ).rows[0]
    : undefined;
  if (edition && !chosen)
    throw new BadRequestException('RBI calendar edition unavailable.');
  return RbiCalendarSchema.parse({
    sourceId: 'rbi-mpc-calendar',
    sourceUrl: RBI_CALENDAR_URL,
    version: 'rbi-mpc-html-v1',
    edition: hash ?? null,
    retrievedAt: chosen?.retrieved_at.toISOString() ?? null,
    data: chosen?.data ?? null,
    editions: rows.map((r) => ({
      edition: r.hash,
      retrievedAt: r.retrieved_at.toISOString(),
    })),
  });
}

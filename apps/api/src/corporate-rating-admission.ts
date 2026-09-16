import type pg from 'pg';
import { ConflictException } from '@nestjs/common';
import {
  CorporateRatingEditionSchema,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
  CORPORATE_RATINGS,
} from '@fingent360/contracts';
export async function admittedCorporateRating(c: pg.PoolClient, id: string) {
  await c.query('LOCK TABLE corporate_rating_reviews IN SHARE MODE');
  const row = (
    await c.query(
      'SELECT e.*,r.decision,r.reviewed_at FROM corporate_rating_editions e JOIN LATERAL (SELECT decision,reviewed_at FROM corporate_rating_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1) r ON TRUE WHERE e.id=$1',
      [id],
    )
  ).rows[0];
  if (!row || row.decision !== 'publish' || row.error)
    throw new ConflictException(
      'Selected credit original is no longer admitted.',
    );
  return CorporateRatingEditionSchema.parse({
    id: row.id,
    version: CORPORATE_RATING_VERSION,
    sourceUrl: CORPORATE_RATING_SOURCE.url,
    hash: row.hash,
    recordedAt: row.recorded_at.toISOString(),
    retrievedAt: null,
    publishedOn: '2026-05-13',
    annexureAsOf: '2026-03-31',
    observations: CORPORATE_RATINGS,
    state: 'published',
    error: null,
    reviewedAt: row.reviewed_at.toISOString(),
  });
}

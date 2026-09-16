import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  EquityEditionSchema,
  EquityCompanySchema,
  buildEquityPriceHistory,
  EquityPriceRangeSchema,
} from '@fingent360/contracts';
export async function readEquityPriceHistory(
  c: pg.PoolClient,
  isin: string,
  range: ReturnType<typeof EquityPriceRangeSchema.parse>,
) {
  await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
  const rows = await c.query(
    "SELECT o.payload,e.id,e.payload-'observations' AS edition FROM equity_observations o JOIN equity_editions e ON e.id=o.edition_id WHERE o.isin=$1 AND o.kind='price' AND o.effective_on BETWEEN $2::date AND $3::date AND (SELECT decision FROM equity_reviews r WHERE r.edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY o.effective_on DESC,e.id,o.ordinal LIMIT 10001",
    [isin, range.from, range.to],
  );
  if (rows.rows.length > 10000)
    throw new ServiceUnavailableException(
      'Too many price revisions in this range. Choose a narrower date range.',
    );
  const records = rows.rows.map((row) => {
    const edition = EquityEditionSchema.omit({ observations: true }).parse(
      row.edition,
    );
    return EquityCompanySchema.shape.records.element.parse({
      observation: row.payload,
      editionId: row.id,
      sourceUrl: edition.sourceUrl,
      hash: edition.hash,
      retrievedAt: edition.retrievedAt,
      publishedAt: edition.publishedAt,
    });
  });
  const counts = new Map<string, number>();
  for (const record of records)
    counts.set(
      record.observation.effectiveOn,
      (counts.get(record.observation.effectiveOn) ?? 0) + 1,
    );
  if ([...counts.values()].some((count) => count > 1000))
    throw new ServiceUnavailableException(
      'One date has too many retained revisions for this reader.',
    );
  return buildEquityPriceHistory(
    isin,
    records,
    range,
    new Date().toISOString(),
  );
}

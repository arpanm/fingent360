import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export const commodityFixtureUrl = new URL(
  '../../../packages/contracts/test/fixtures/world-bank-monthly-2026-09.xlsx',
  import.meta.url,
);
export const commodityRights =
  'World Bank Commodity Prices — History and Projections catalogue CC BY4; dataset attribution and original-provider terms reviewed for this isolated acceptance capture.';
export async function commodityInput() {
  return {
    requestId: randomUUID(),
    body: (await readFile(commodityFixtureUrl)).toString('base64'),
    rightsEvidence: commodityRights,
  };
}

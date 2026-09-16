import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  FeedItemSchema,
  NSE_FLOWS_URL,
} from '../../../packages/contracts/src/index';
import { rbiPolicySource } from './rbi-policy-scenario';
import { companyPackSources, governancePackSource } from './company-event-pack';
import { historicalFlowInput } from './institutional-flows';
import { sourceHash, plain } from '../../../apps/api/src/discovery-provider';
/** Existing primary-backed anchors; database admission and editorial context remain explicitly simulated. */
export async function transmissionFamilySource(family: string) {
  if (family === 'policy-rate') return rbiPolicySource();
  if (family === 'earnings' || family === 'guidance') {
    const value = await companyPackSources();
    return value.source;
  }
  if (family === 'regulatory') return governancePackSource();
  const at = new Date().toISOString();
  let url: string, body: string, title: string, label: string;
  if (family === 'gdp') {
    const pack = JSON.parse(
      await readFile(
        new URL(
          '../../../packages/contracts/test/fixtures/bea-gdp-2025-vintages.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { sources: { url: string; quote: string; publishedAt: string }[] };
    const value = pack.sources[0]!;
    url = value.url;
    body = value.quote;
    title = 'Historical BEA GDP second estimate';
    label =
      value.publishedAt +
      ' original timestamp; test source admission is simulated';
  } else if (family === 'inflation') {
    url = 'https://www.bls.gov/news.release/archives/cpi_08142024.htm';
    body =
      'Historical BLS Table 4 CPI-U annual change, not seasonally adjusted: July 2024 2.9%; June 2024 3.0%. This reconstruction describes a prior observation, not a consensus forecast.';
    title = 'Historical CPI prior-observation facts';
    label =
      '2024-08-14 original publication day; test timestamp is admission only';
  } else if (family === 'flows') {
    url = NSE_FLOWS_URL;
    body = plain(historicalFlowInput().body);
    title = 'Historical NSE investor-category cash activity';
    label =
      '2026-09-11 reported activity date; reconstructed source table, not original retained provider bytes';
  } else throw Error('Unsupported family fixture.');
  return FeedItemSchema.parse({
    id: 'primary-family-' + randomUUID(),
    version: 1,
    kind: 'news',
    title,
    summary: body.slice(0, 300),
    body,
    topics: ['Research'],
    publishedAt: at,
    effectiveLabel: label,
    source: {
      name: 'Primary-source acceptance fixture',
      url,
      retrievedAt: at,
      rights:
        'TEST-SIMULATION: existing researched numerical facts/minimal anchors; no live permission claim.',
    },
    sourceHash: sourceHash(url, body),
    importance: 1,
    relatedIds: [],
    status: 'published',
    reviewedAt: at,
    correctionNote: null,
  });
}

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  EventPublicSchema,
  IntelligenceBriefReceiptSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import {
  parseHistoricalFedPolicy,
  FED_POLICY_HISTORY_URLS,
} from '../../../apps/api/src/fed-policy-provider';
import { parseHistoricalBeaGdp } from '../../../apps/api/src/bea-gdp-history-provider';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import { oilEducationFixture, headers } from './oil-education';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export { headers };
export async function intelligenceBriefFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const oil = await oilEducationFixture(request, playwright, sandbox);
  try {
    const at = new Date().toISOString(),
      sources: FeedItem[] = [];
    for (const [index, date] of ['20240731', '20240918'].entries()) {
      const url = FED_POLICY_HISTORY_URLS[index]!,
        body = await readFile(
          new URL(
            `../../../packages/contracts/test/fixtures/fomc-${date}.html.txt`,
            import.meta.url,
          ),
          'utf8',
        );
      sources.push({
        ...parseHistoricalFedPolicy({
          url,
          body,
          hash: sourceHash(url, body),
          retrievedAt: at,
        }),
        status: 'published',
        reviewedAt: at,
      });
    }
    const pack = JSON.parse(
      await readFile(
        new URL(
          '../../../packages/contracts/test/fixtures/bea-gdp-2025-vintages.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { sources: { url: string; quote: string }[] };
    for (const row of pack.sources)
      sources.push({
        ...parseHistoricalBeaGdp({
          url: row.url,
          body: row.quote,
          hash: sourceHash(row.url, row.quote),
          retrievedAt: at,
        }),
        status: 'published',
        reviewedAt: at,
      });
    const db = await connectionDatabase(sandbox);
    try {
      for (const source of sources) {
        await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
          source.id,
        ]);
        await db.query(
          'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
          [source.id, source],
        );
      }
    } finally {
      await db.end();
    }
    const events = [oil.event];
    for (const source of sources) {
      const id = randomUUID(),
        editorial = {
          title: source.title,
          family: 'Historical official macro release',
          geography: ['United States'],
          claimKind: 'fact',
          explanation: source.summary,
          announcedAt: source.publishedAt,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: source.version,
              hash: source.sourceHash,
              field: 'body',
              quote: source.body,
            },
          ],
          links: [],
        };
      expect(
        (
          await request.put('/api/v1/ops/events/' + id, {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 0,
              revisionReason:
                'Actual historical government source, simulated source admission.',
              editorial,
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await oil.reviewer.post(`/api/v1/ops/events/${id}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              status: 'published',
              note: 'Independent actual-source historical point review.',
            },
          })
        ).status(),
      ).toBe(201);
      events.push(
        EventPublicSchema.parse(
          await (await request.get('/api/v1/events/' + id)).json(),
        ),
      );
    }
    const id = randomUUID(),
      input = {
        requestId: randomUUID(),
        expectedVersion: 0,
        title: 'Five historical source-backed points',
        reason:
          'Historical source selection; no current-market or forecast claim.',
        events: events.map((event) => ({
          id: event.id,
          version: event.event!.version,
        })),
      },
      prepared = await request.put('/api/v1/ops/intelligence-briefs/' + id, {
        headers,
        data: input,
      });
    expect(prepared.status(), await prepared.text()).toBe(200);
    const receipt = IntelligenceBriefReceiptSchema.parse(await prepared.json());
    return { ...oil, id, input, receipt, events };
  } catch (cause) {
    await oil.reviewer.dispose();
    throw cause;
  }
}

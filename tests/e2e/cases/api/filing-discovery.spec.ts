import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  indiaActors,
  retentionHeaders,
  filingRss,
  discoveryRights,
  runFilingTick,
} from '../../helpers/filing-discovery';
import {
  FILING_DISCOVERY_URL,
  FilingDiscoveryCaptureSchema,
  FilingDiscoveryInboxSchema,
  parseFilingDiscovery,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-2000 retained official RSS discovery is idempotent preserves changed metadata and never invents financial identities @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = { requestId: randomUUID(), body: filingRss() };
  try {
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/capture', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: discoveryRights },
        })
      ).status(),
    ).toBe(201);
    const first = await request.post('/api/v1/ops/filing-discovery/capture', {
      headers: retentionHeaders,
      data: input,
    });
    expect(first.status()).toBe(201);
    const receipt = FilingDiscoveryCaptureSchema.parse(await first.json());
    expect(receipt).toMatchObject({ status: 'retained', itemCount: 2 });
    expect(
      await (
        await request.post('/api/v1/ops/filing-discovery/capture', {
          headers: retentionHeaders,
          data: input,
        })
      ).json(),
    ).toEqual(receipt);
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/capture', {
          headers: retentionHeaders,
          data: { ...input, body: filingRss({ revision: true }) },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/capture', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            body: filingRss({ revision: true }),
          },
        })
      ).status(),
    ).toBe(201);
    let inbox = FilingDiscoveryInboxSchema.parse(
      await (await request.get('/api/v1/ops/filing-discovery')).json(),
    );
    expect(inbox.captures).toHaveLength(2);
    expect(inbox.items).toHaveLength(4);
    expect(
      inbox.items.every(
        (v) =>
          v.item.timezone === 'unknown' && v.item.identityStatus === 'unmapped',
      ),
    ).toBe(true);
    expect(
      await (
        await request.get(
          '/api/v1/ops/filing-discovery/' + input.requestId + '/evidence',
        )
      ).json(),
    ).toMatchObject({ body: input.body });
    expect(
      (await (await request.get('/api/v1/equities')).json()).companies,
    ).toHaveLength(0);
    const bad = await request.post('/api/v1/ops/filing-discovery/capture', {
      headers: retentionHeaders,
      data: {
        requestId: randomUUID(),
        body: '<rss>Unsupported original</rss>',
      },
    });
    expect(FilingDiscoveryCaptureSchema.parse(await bad.json())).toMatchObject({
      status: 'quarantined',
      itemCount: 0,
    });
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/gate', {
          headers: retentionHeaders,
          data: { enabled: false, rightsEvidence: discoveryRights },
        })
      ).status(),
    ).toBe(201);
    inbox = FilingDiscoveryInboxSchema.parse(
      await (await request.get('/api/v1/ops/filing-discovery')).json(),
    );
    expect(inbox.items).toHaveLength(4);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-2001 RSS rejects external entities arbitrary links impossible dates unknown item fields and duplicate entries @SRC-004 @TEST-SIMULATION', () => {
  const rss = filingRss();
  expect(parseFilingDiscovery(rss)[0]).toMatchObject({
    submission: 'Original',
    publishedLiteral: '15-Sep-2026 17:02:11',
    timezone: 'unknown',
  });
  for (const body of [
    rss.replace(
      '<rss',
      '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss',
    ),
    rss.replace(
      'nsearchives.nseindia.com/corporate/xbrl',
      'evil.example/private',
    ),
    rss.replaceAll('15-Sep-2026 17:02:11', '31-Feb-2026 25:00:00'),
    rss.replace('</item>', '<isin>INVENTED</isin></item>'),
    rss.replace(
      '</channel>',
      rss.match(/<item>.*?<\/item>/)![0] + '</channel>',
    ),
  ])
    expect(() => parseFilingDiscovery(body)).toThrow();
});
test('E2E-API-2002 actual research schedule deduplicates RSS bodies and denies permission change during fetch @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    gate = { enabled: true, rightsEvidence: discoveryRights };
  try {
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/gate', {
          headers: retentionHeaders,
          data: gate,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: {
            sourceId: 'equity-filing-discovery',
            enabled: true,
            intervalMinutes: 1440,
          },
        })
      ).status(),
    ).toBe(200);
    for (let i = 0; i < 2; i++)
      expect(
        await runFilingTick(
          feedbackSandbox,
          { [FILING_DISCOVERY_URL]: filingRss() },
          undefined,
          'equity-filing-discovery',
        ),
      ).toBe(1);
    expect(
      FilingDiscoveryInboxSchema.parse(
        await (await request.get('/api/v1/ops/filing-discovery')).json(),
      ).captures,
    ).toHaveLength(1);
    await expect(
      runFilingTick(
        feedbackSandbox,
        { [FILING_DISCOVERY_URL]: filingRss({ revision: true }) },
        async () => {
          expect(
            (
              await request.post('/api/v1/ops/filing-discovery/gate', {
                headers: retentionHeaders,
                data: { ...gate, enabled: false },
              })
            ).status(),
          ).toBe(201);
        },
        'equity-filing-discovery',
      ),
    ).rejects.toThrow();
    expect(
      FilingDiscoveryInboxSchema.parse(
        await (await request.get('/api/v1/ops/filing-discovery')).json(),
      ).captures,
    ).toHaveLength(1);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-2003 RSS inbox continues all equal-time pointers without duplication and rejects missing cursor @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: discoveryRights },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/capture', {
          headers: retentionHeaders,
          data: { requestId: randomUUID(), body: filingRss({ count: 23 }) },
        })
      ).status(),
    ).toBe(201);
    const first = FilingDiscoveryInboxSchema.parse(
        await (await request.get('/api/v1/ops/filing-discovery')).json(),
      ),
      second = FilingDiscoveryInboxSchema.parse(
        await (
          await request.get('/api/v1/ops/filing-discovery?after=' + first.next)
        ).json(),
      );
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(3);
    expect(
      new Set([...first.items, ...second.items].map((v) => v.id)).size,
    ).toBe(23);
    expect(second.next).toBeNull();
    expect(
      (
        await request.get(
          '/api/v1/ops/filing-discovery?after=' + 'f'.repeat(64),
        )
      ).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { captureIdentitySelections } from '../../scripts/identity-selection-snapshot.mjs';
const isin = 'INE002A01018',
  at = '2026-09-14T00:00:00.000Z';
const candidate = {
  figi: 'BBG000000001',
  name: 'Synthetic capture candidate',
  ticker: 'SYN',
  exchCode: 'IN',
  securityType: 'Common Stock',
  marketSector: 'Equity',
  compositeFIGI: null,
  shareClassFIGI: null,
};
const provider = {
  isin,
  version: 1,
  resolution: 'matched',
  sourceHash: 'a'.repeat(64),
  candidates: [candidate],
};
const receipt = {
  id: randomUUID(),
  isin,
  version: 1,
  providerVersion: 1,
  providerHash: provider.sourceHash,
  candidate,
  rationale: 'Synthetic editorial judgement for snapshot.',
  reviewedAt: at,
  method: 'editorial-judgement',
  status: 'approved',
};
const current = { isin, state: 'current', receipt, evaluatedAt: at };
test('selection snapshot captures complete bounded history and refuses known provider or decision changes', async () => {
  const get = async (path) =>
    path.includes('/history')
      ? { receipts: [receipt], nextBefore: null }
      : current;
  const captured = await captureIdentitySelections(get, { items: [provider] });
  assert.deepEqual(captured.identitySelectionHistories[isin], [receipt]);
  await assert.rejects(
    captureIdentitySelections(get, { items: [{ ...provider, version: 2 }] }),
    /Provider changed/,
  );
  let reads = 0;
  await assert.rejects(
    captureIdentitySelections(
      async (path) =>
        path.includes('/history')
          ? { receipts: [receipt], nextBefore: null }
          : ++reads === 1
            ? current
            : {
                ...current,
                state: 'withdrawn',
                receipt: { ...receipt, status: 'withdrawn' },
              },
      { items: [provider] },
    ),
    /Selection changed/,
  );
});
test('selection snapshot rejects wrong identity and non-advancing retained history', async () => {
  await assert.rejects(
    captureIdentitySelections(
      async () => ({
        ...current,
        isin: 'INE009A01021',
        receipt: { ...receipt, isin: 'INE009A01021' },
      }),
      { items: [provider] },
    ),
    /Wrong identity/,
  );
  await assert.rejects(
    captureIdentitySelections(
      async (path) =>
        path.includes('/history')
          ? { receipts: [receipt], nextBefore: 1 }
          : current,
      { items: [provider] },
    ),
    /did not advance/,
  );
});

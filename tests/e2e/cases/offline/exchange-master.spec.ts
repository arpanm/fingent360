import { test, expect } from '@playwright/test';
import { masterInput } from '../../helpers/exchange-master';
import {
  EquityCompanySchema,
  parseEquitySource,
  reconcileEquityIdentity,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1580 downloaded identity reconciliation rejects forged consensus and preserves dated symbol editions @SRC-001 @TEST-SIMULATION', async () => {
  const inputs = [masterInput(), masterInput('NEW', '2025-02-01')];
  const records = inputs.map((data) => ({
    observation: parseEquitySource(
      'nse-equity-master-v2',
      data.body,
      data.effectiveOn,
    ).observations[0]!,
    editionId: data.requestId,
    sourceUrl: data.sourceUrl,
    hash: 'a'.repeat(64),
    retrievedAt: '2025-02-02T00:00:00.000Z',
    publishedAt: null,
  }));
  const company = {
    isin: 'INE002A01018',
    name: 'Synthetic Identity Limited',
    records,
    truncated: false,
    identityReconciliation: reconcileEquityIdentity(records, false),
  };
  expect(
    EquityCompanySchema.parse(JSON.parse(JSON.stringify(company)))
      .identityReconciliation?.symbols,
  ).toEqual(['NSE:EQ:NEW', 'NSE:EQ:SYNTHETIC']);
  expect(
    EquityCompanySchema.safeParse({
      ...company,
      identityReconciliation: {
        ...company.identityReconciliation,
        symbols: ['NSE:EQ:FORGED'],
      },
    }).success,
  ).toBe(false);
  expect(
    EquityCompanySchema.safeParse({ ...company, isin: 'INE009A01021' }).success,
  ).toBe(false);
});

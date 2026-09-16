import { test, expect } from '@playwright/test';
import {
  parseAmfiNav,
  factsheetIdentityMatches,
} from '../../../../packages/contracts/src/index';
// Primary AMFI NAVAll.txt inspected15September2026, source row date11September2026.
// Original full-file SHA256: c43c3d5ebcc6805d2792db0d645ec62ff6ea98a84026baf0ec10668d6a9a04c5.
// This minimal reconstructed section keeps public identity facts, not the whole source file.
const publicIdentitySection = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
Open Ended Schemes(Other Scheme - FoF Domestic)
Kotak Mahindra Mutual Fund
119777;INF174K01LN3;-;Kotak Multi Asset Omni FOF;Direct Plan;Growth;279.372;11-Sep-2026
119776;INF174K01LO1;INF174K01LP8;Kotak Multi Asset Omni FOF;Direct Plan;Payout of Income Distribution cum capital withdrawal option;274.345;11-Sep-2026
102574;INF174K01468;-;Kotak Multi Asset Omni FOF;Regular Plan;Growth;257.493;11-Sep-2026
102573;INF174K01484;INF174K01476;Kotak Multi Asset Omni FOF;Regular Plan;Payout of Income Distribution cum capital withdrawal option;250.644;11-Sep-2026
`;
test('E2E-API-1913 actual AMFI Kotak source spelling and explicit plans match while other funds or missing plans fail @SRC-016', async () => {
  const rows = parseAmfiNav(publicIdentitySection);
  expect(rows.map((r) => r.schemeCode)).toEqual([
    '119777',
    '119776',
    '102574',
    '102573',
  ]);
  for (const [i, row] of rows.entries()) {
    const plan = i < 2 ? 'Direct' : 'Regular';
    expect(factsheetIdentityMatches(row, plan)).toBe(true);
    expect(
      factsheetIdentityMatches(row, plan === 'Direct' ? 'Regular' : 'Direct'),
    ).toBe(false);
    expect(factsheetIdentityMatches({ ...row, plan: null }, plan)).toBe(false);
    expect(
      factsheetIdentityMatches(
        { ...row, name: 'Kotak Multi Asset Allocation Fund' },
        plan,
      ),
    ).toBe(false);
    expect(
      factsheetIdentityMatches({ ...row, amc: 'Another Mutual Fund' }, plan),
    ).toBe(false);
  }
});

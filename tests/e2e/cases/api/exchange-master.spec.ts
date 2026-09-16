import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  masterInput,
} from '../../helpers/exchange-master';
import {
  EquityCompanySchema,
  parseEquitySource,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1580 original NSE master retains full identity symbol history same-date conflict and withdrawal @SRC-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    for (const data of [
      masterInput(),
      masterInput('RENAMED', '2025-02-01'),
      masterInput('CONFLICT', '2025-02-01'),
    ]) {
      const result = await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data,
      });
      expect(result.status(), await result.text()).toBe(201);
      const review = {
        requestId: randomUUID(),
        editionId: data.requestId,
        decision: 'publish',
        reason: 'Synthetic independently reviewed original master.',
      };
      expect(
        (
          await request.post('/api/v1/ops/equities/review', {
            headers: retentionHeaders,
            data: review,
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await reviewer.post('/api/v1/ops/equities/review', {
            headers: retentionHeaders,
            data: review,
          })
        ).status(),
      ).toBe(201);
      const company = EquityCompanySchema.parse(
        await (await request.get('/api/v1/equities/INE002A01018')).json(),
      );
      expect(company.records[0]?.observation).toMatchObject({
        kind: 'identity',
        paidUpValue: '10',
        marketLot: '1',
      });
      if (data.body.includes('CONFLICT')) {
        expect(company.identityReconciliation?.conflicts).toEqual([
          'NSE:EQ:2025-02-01',
        ]);
        expect(
          (
            await reviewer.post('/api/v1/ops/equities/review', {
              headers: retentionHeaders,
              data: {
                ...review,
                requestId: randomUUID(),
                decision: 'withdraw',
              },
            })
          ).status(),
        ).toBe(201);
        const remaining = EquityCompanySchema.parse(
          await (await request.get('/api/v1/equities/INE002A01018')).json(),
        );
        expect(remaining.identityReconciliation?.symbols).toEqual([
          'NSE:EQ:RENAMED',
          'NSE:EQ:SYNTHETIC',
        ]);
        expect(remaining.identityReconciliation?.conflicts).toEqual([]);
      }
    }
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1581 exact master rejects row width lot listing date and ambiguous symbol binding @SRC-001 @TEST-SIMULATION', async () => {
  const data = masterInput();
  for (const body of [
    data.body.replace(',10\n', ',10,extra\n'),
    data.body.replace(',10,1,', ',10,0,'),
    data.body.replace('01-JAN-2020', '01-JAN-2026'),
    data.body +
      data.body.split('\n')[1]!.replace('INE002A01018', 'INE009A01021') +
      '\n',
  ])
    expect(() =>
      parseEquitySource(
        data.parser as 'nse-equity-master-v2',
        body,
        data.effectiveOn,
      ),
    ).toThrow();
  expect(
    parseEquitySource('nse-equity-master-v1', data.body, data.effectiveOn)
      .observations[0],
  ).not.toHaveProperty('marketLot');
});

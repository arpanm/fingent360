import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  statementInput,
} from '../../helpers/equity-statements';
import {
  EquityCompanySchema,
  parseEquitySource,
  NSE_INDAS_STATEMENTS_PARSER,
  StatementContextSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1510 independently reviewed original statement totals retain cash concepts exact reconciliation and withdraw @SRC-005 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await statementInput();
  try {
    const capture = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: input.requestId,
      decision: 'publish',
      reason: 'Synthetic independent full statement totals review.',
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
    expect(company.records.map((record) => record.observation)).toContainEqual(
      expect.objectContaining({
        kind: 'fundamental',
        metric: 'cash-flow-closing',
        value: '-2.00',
        basis: 'consolidated',
        scale: 'lakhs',
      }),
    );
    expect(company.records.map((record) => record.observation)).toContainEqual(
      expect.objectContaining({
        kind: 'fundamental',
        metric: 'balance-sheet-cash',
        value: '10.00',
      }),
    );
    expect(
      (
        await (
          await request.get(
            '/api/v1/ops/equities/' + input.requestId + '/evidence',
          )
        ).json()
      ).body,
    ).toBe(input.body);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: { ...review, requestId: randomUUID(), decision: 'withdraw' },
        })
      ).status(),
    ).toBe(201);
    expect((await request.get('/api/v1/equities/INE002A01018')).status()).toBe(
      404,
    );
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1511 incompatible statement totals scales and contexts cannot become valid financial records @SRC-005 @TEST-SIMULATION', async () => {
  const input = await statementInput(),
    parsed = parseEquitySource(
      NSE_INDAS_STATEMENTS_PARSER,
      input.body,
      input.effectiveOn,
    );
  expect(parsed.observations).toHaveLength(19);
  for (const body of [
    input.body.replace(
      'Total assets</th><td>100.00',
      'Total assets</th><td>101.00',
    ),
    input.body.replace('Amount in (Lakhs)', 'Amount in (Crores)'),
    input.body.replace(
      'Cash flow statement, indirect',
      'Cash flow statement, direct',
    ),
    input.body.replace(
      'cash flow statement at end of period</th><td>(2.00)',
      'cash flow statement at end of period</th><td>(3.00)',
    ),
  ])
    expect(() =>
      parseEquitySource(NSE_INDAS_STATEMENTS_PARSER, body, input.effectiveOn),
    ).toThrow();
  const cash = parsed.observations.find(
    (row) => row.kind === 'fundamental' && row.metric === 'cash-flow-closing',
  );
  if (cash?.kind !== 'fundamental' || !cash.statementContext)
    throw Error('Expected statement context.');
  const corrupt = structuredClone(cash.statementContext);
  if (corrupt.section !== 'cash-flow')
    throw Error('Expected cash-flow context.');
  corrupt.values['net-cash-change'] = '999';
  expect(StatementContextSchema.safeParse(corrupt).success).toBe(false);
});

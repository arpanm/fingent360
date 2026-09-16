import { test, expect } from '@playwright/test';
import { statementInput } from '../../helpers/equity-statements';
import {
  EquityObservationSchema,
  parseEquitySource,
  NSE_INDAS_STATEMENTS_PARSER,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1510 retained statement observation reconstructs reported totals and rejects altered cash value or aggregate proof @SRC-005 @TEST-SIMULATION', async () => {
  const input = await statementInput(),
    rows = parseEquitySource(
      NSE_INDAS_STATEMENTS_PARSER,
      input.body,
      input.effectiveOn,
    ).observations;
  const closing = rows.find(
    (row) => row.kind === 'fundamental' && row.metric === 'cash-flow-closing',
  );
  if (closing?.kind !== 'fundamental')
    throw Error('Expected closing cash row.');
  expect(
    EquityObservationSchema.parse(JSON.parse(JSON.stringify(closing))),
  ).toEqual(closing);
  expect(
    EquityObservationSchema.safeParse({ ...closing, value: '10.00' }).success,
  ).toBe(false);
  expect(
    EquityObservationSchema.safeParse({
      ...closing,
      statementContext: {
        ...closing.statementContext,
        values: {
          ...closing.statementContext?.values,
          'cash-flow-opening': '100',
        },
      },
    }).success,
  ).toBe(false);
});

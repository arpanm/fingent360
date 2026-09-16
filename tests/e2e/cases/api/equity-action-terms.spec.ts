import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  actionTermsActors,
  actionTermsReview,
} from '../../helpers/equity-action-terms';
import { ActionTermsPublicSchema } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
for (const kind of ['rights', 'stock-swap-merger'] as const)
  test(`E2E-API-${kind === 'rights' ? '1930' : '1931'} reviewed ${kind} original terms preserve exact rational comparison and withdrawal @SRC-003 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const { reviewer, ids, data } = await actionTermsActors(
      request,
      playwright,
      feedbackSandbox,
      kind,
    );
    try {
      expect(
        (
          await request.post('/api/v1/ops/equity-action-terms/prepare', {
            headers: retentionHeaders,
            data,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await request.post('/api/v1/ops/equity-action-terms/prepare', {
            headers: retentionHeaders,
            data,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await request.post('/api/v1/ops/equity-action-terms/review', {
            headers: retentionHeaders,
            data: actionTermsReview(data.requestId),
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await reviewer.post('/api/v1/ops/equity-action-terms/review', {
            headers: retentionHeaders,
            data: actionTermsReview(data.requestId),
          })
        ).status(),
      ).toBe(201);
      const view = ActionTermsPublicSchema.parse(
        await (
          await request.get(`/api/v1/equity-action-terms/${data.terms.oldIsin}`)
        ).json(),
      );
      expect(view.actions).toHaveLength(1);
      expect(view.actions[0]?.comparison).toEqual(
        kind === 'rights'
          ? {
              numerator: '22850',
              denominator: '119',
              display: '192.016806722689',
            }
          : {
              numerator: '5000',
              denominator: '3',
              display: '1666.666666666667',
            },
      );
      expect(view.actions[0]?.calibrationEligibility).toBe(
        'ineligible-conditional-complex-action-comparison',
      );
      expect(view.actions[0]?.terms.fractionTreatment).toBe(
        data.terms.fractionTreatment,
      );
      const evidence = await (
        await reviewer.get(
          `/api/v1/ops/equity-action-terms/${data.requestId}/evidence`,
        )
      ).json();
      expect(evidence.original.bytesBase64).toBe(data.original.bytesBase64);
      expect(
        (
          await reviewer.post('/api/v1/ops/equities/review', {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              editionId: ids[0],
              decision: 'withdraw',
              reason: 'Withdraw bound identity and price evidence.',
            },
          })
        ).status(),
      ).toBe(201);
      expect(
        ActionTermsPublicSchema.parse(
          await (
            await request.get(
              `/api/v1/equity-action-terms/${data.terms.oldIsin}`,
            )
          ).json(),
        ).actions,
      ).toHaveLength(0);
      expect(
        (
          await reviewer.post('/api/v1/ops/equity-action-terms/review', {
            headers: retentionHeaders,
            data: actionTermsReview(data.requestId, 'withdraw'),
          })
        ).status(),
      ).toBe(201);
    } finally {
      await reviewer.dispose();
    }
  });
test('E2E-API-1932 unsupported cash dates missing source and changed request stay rejected @SRC-003 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer, data } = await actionTermsActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    for (const terms of [
      { ...data.terms, fixedCashPerOldShare: '1' },
      { ...data.terms, priceOn: data.terms.exOn },
    ])
      expect(
        (
          await request.post('/api/v1/ops/equity-action-terms/prepare', {
            headers: retentionHeaders,
            data: { ...data, requestId: randomUUID(), terms },
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await request.post('/api/v1/ops/equity-action-terms/prepare', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/equity-action-terms/prepare', {
          headers: retentionHeaders,
          data: { ...data, terms: { ...data.terms, subscriptionPrice: '151' } },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await reviewer.get('/api/v1/ops/equity-action-terms?after=bad')
      ).status(),
    ).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});

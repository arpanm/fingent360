import {
  EcbRatePublicSchema,
  EcbRateHistorySchema,
} from '../packages/contracts/dist/index.js';

/** Called only by the user's explicit snapshot command. No work at import time. */
export async function captureEcbRates(read) {
  const first = EcbRatePublicSchema.parse(await read('/policy-rates'));
  const editions = [];
  if (first.status === 'published') {
    let before = null;
    const seen = new Set();
    do {
      const page = EcbRateHistorySchema.parse(
        await read(
          '/policy-rates/history' +
            (before === null ? '' : `?before=${before}`),
        ),
      );
      for (const edition of page.editions) {
        if (seen.has(edition.edition))
          throw Error('Rate snapshot pagination repeated an edition.');
        seen.add(edition.edition);
        editions.push(edition);
      }
      if (
        editions.length > 500 ||
        (before !== null &&
          page.nextBefore !== null &&
          page.nextBefore >= before)
      )
        throw Error('Rate snapshot exceeds its retained history bound.');
      before = page.nextBefore;
    } while (before !== null);
    if (
      !editions.some(
        (edition) =>
          edition.edition === first.edition.edition &&
          edition.sourceHash === first.edition.sourceHash,
      )
    )
      throw Error('Published rate snapshot is missing its current edition.');
  }
  const last = EcbRatePublicSchema.parse(await read('/policy-rates'));
  if (
    JSON.stringify([
      first.status,
      first.edition,
      first.reviewedAt,
      first.checkedAt,
    ]) !==
    JSON.stringify([last.status, last.edition, last.reviewedAt, last.checkedAt])
  )
    throw Error(
      'Rate source changed while the bundle was captured. Retry the snapshot.',
    );
  return {
    policyRates: last,
    policyRateHistory: editions,
    policyRateAdmittedEditions: editions.map((edition) => edition.edition),
  };
}

import {
  EcbFxPublicSchema,
  EcbFxHistorySchema,
} from '../packages/contracts/dist/index.js';

/** Called only by the user's explicit snapshot command. No work at import time. */
export async function captureEcbFx(read) {
  const first = EcbFxPublicSchema.parse(await read('/reference-fx'));
  const editions = [];
  if (first.status === 'published') {
    let before = null;
    const seen = new Set();
    do {
      const page = EcbFxHistorySchema.parse(
        await read(
          '/reference-fx/history' +
            (before === null ? '' : `?before=${before}`),
        ),
      );
      for (const edition of page.editions) {
        if (seen.has(edition.edition))
          throw Error('FX snapshot pagination repeated an edition.');
        seen.add(edition.edition);
        editions.push(edition);
      }
      if (
        editions.length > 500 ||
        (before !== null &&
          page.nextBefore !== null &&
          page.nextBefore >= before)
      )
        throw Error('FX snapshot exceeds its retained history bound.');
      before = page.nextBefore;
    } while (before !== null);
    if (
      !editions.some(
        (edition) =>
          edition.edition === first.edition.edition &&
          edition.sourceHash === first.edition.sourceHash,
      )
    )
      throw Error('Published FX snapshot is missing its current edition.');
  }
  const last = EcbFxPublicSchema.parse(await read('/reference-fx'));
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
      'FX source changed while the bundle was captured. Retry the snapshot.',
    );
  return {
    ecbFx: last,
    ecbFxHistory: editions,
    ecbFxAdmittedEditions: editions.map((edition) => edition.edition),
  };
}

import {
  OilBenchmarkPublicSchema,
  OilBenchmarkHistorySchema,
} from '../packages/contracts/dist/index.js';

/** Called only by the user's explicit snapshot command. No work at import time. */
export async function captureOilBenchmarks(read) {
  const first = OilBenchmarkPublicSchema.parse(await read('/oil-benchmarks'));
  const editions = [];
  if (first.status === 'published') {
    let before = null;
    const seen = new Set();
    do {
      const page = OilBenchmarkHistorySchema.parse(
        await read(
          '/oil-benchmarks/history' +
            (before === null ? '' : `?before=${before}`),
        ),
      );
      for (const edition of page.editions) {
        if (seen.has(edition.edition))
          throw Error('Oil snapshot pagination repeated an edition.');
        seen.add(edition.edition);
        editions.push(edition);
      }
      if (
        editions.length > 500 ||
        (before !== null &&
          page.nextBefore !== null &&
          page.nextBefore >= before)
      )
        throw Error('Oil snapshot exceeds its retained history bound.');
      before = page.nextBefore;
    } while (before !== null);
    if (
      !editions.some(
        (edition) =>
          edition.edition === first.edition.edition &&
          edition.sourceHash === first.edition.sourceHash,
      )
    )
      throw Error('Published oil snapshot is missing its current edition.');
  }
  const last = OilBenchmarkPublicSchema.parse(await read('/oil-benchmarks'));
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
      'Oil source changed while the bundle was captured. Retry the snapshot.',
    );
  return {
    oilBenchmarks: last,
    oilBenchmarkHistory: editions,
    oilBenchmarkAdmittedEditions: editions.map((edition) => edition.edition),
  };
}

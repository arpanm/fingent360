import { test, expect, indiaActors } from '../../helpers/india-gdp';
import { seedIndiaMacroPages } from '../../helpers/india-macro-pagination';
import {
  IndiaMacroQueuePageSchema,
  IndiaMacroAttemptPageSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1810 India macro editions and quarantine paginate101 microsecond ordered rows without omission @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const seed = await seedIndiaMacroPages(request, feedbackSandbox);
    for (const [path, oldest] of [
      ['queue', seed.retained],
      ['attempt-page', seed.rejected],
    ]) {
      let cursor: string | null = null;
      const ids: string[] = [];
      for (let page = 0; page < 5; page++) {
        const response = await request.get(
          `/api/v1/ops/india-macro/${path}${cursor ? '?after=' + encodeURIComponent(cursor) : ''}`,
        );
        expect(response.status(), await response.text()).toBe(200);
        const result =
          path === 'queue'
            ? IndiaMacroQueuePageSchema.parse(await response.json())
            : IndiaMacroAttemptPageSchema.parse(await response.json());
        expect(result.rows).toHaveLength(page === 4 ? 1 : 25);
        ids.push(...result.rows.map((row) => row.id));
        cursor = result.nextCursor;
      }
      expect(cursor).toBeNull();
      expect(new Set(ids).size).toBe(101);
      expect(ids.at(-1)).toBe(oldest);
      expect(
        (
          await request.get(`/api/v1/ops/india-macro/${path}?after=bad`)
        ).status(),
      ).toBe(400);
      expect(
        (
          await request.get(
            `/api/v1/ops/india-macro/${path}?after=${encodeURIComponent('2026-02-30T00:00:00.000000Z|' + oldest)}`,
          )
        ).status(),
      ).toBe(400);
    }
  } finally {
    await reviewer.dispose();
  }
});

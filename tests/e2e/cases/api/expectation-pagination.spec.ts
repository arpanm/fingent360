import { test, expect, indiaActors } from '../../helpers/gdp-expectations';
import { seedExpectationQueue } from '../../helpers/expectation-pagination';
test.use({ namedOperators: true });
for (const [id, domain] of [
  [1624, 'gdp'],
  [1673, 'cpi'],
] as const) {
  test(`E2E-API-${id} ${domain} source queue reaches101 actual stored drafts without precision loss @EVENT-SCENARIOS-001 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const reviewer = await indiaActors(request, playwright, feedbackSandbox);
    try {
      const original = await seedExpectationQueue(
          domain,
          request,
          feedbackSandbox,
        ),
        ids: string[] = [];
      let after: string | null = null;
      for (let page = 0; page < 5; page++) {
        const response = await request.get(
          `/api/v1/ops/${domain}-expectations` +
            (after ? '?after=' + encodeURIComponent(after) : ''),
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.editions.length).toBeLessThanOrEqual(25);
        ids.push(
          ...body.editions.map(
            (row: { edition: { id: string } }) => row.edition.id,
          ),
        );
        after = body.nextCursor;
      }
      expect(after).toBeNull();
      expect(ids).toHaveLength(101);
      expect(new Set(ids).size).toBe(101);
      expect(ids.at(-1)).toBe(original);
      expect(
        (
          await request.get(`/api/v1/ops/${domain}-expectations?after=invalid`)
        ).status(),
      ).toBe(400);
    } finally {
      await reviewer.dispose();
    }
  });
}

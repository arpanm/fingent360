import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders,
} from '../../helpers/research-governance';
import { routeConnectionReading } from '../../helpers/research-connection-fixture';
import { ResearchGovernanceRevisionSchema } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-WEB-1501 analytical qualitative context shows release limits and an actual source link @DEV-016 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const id = randomUUID(),
      input = {
        ...fixture.input,
        requestId: randomUUID(),
        title: 'Synthetic published reader interpretation',
        content: {
          kind: 'causal-context',
          sector: 'Synthetic sector',
          isin: null,
          direction: 'unknown',
          horizon: 'Synthetic future period',
          limitations:
            'This qualitative context does not establish a market reaction or quantified portfolio impact.',
          quantifiedImpact: null,
        },
      };
    const response = await request.put(
      '/api/v1/ops/research-governance/' + id,
      { headers: governanceHeaders, data: input },
    );
    expect(response.status()).toBe(200);
    const revision = ResearchGovernanceRevisionSchema.parse(
      await response.json(),
    );
    await releaseGovernanceFixture(request, { ...fixture, id, revision });
    const source = revision.event.event!.sources[0]!;
    await routeConnectionReading(page, feedbackSandbox);
    await page.goto('/#read/' + source.id);
    const region = page.getByRole('region', { name: 'Explanation layers' });
    await region
      .getByText('Analytical — evidence and limits', { exact: true })
      .click();
    const context = region.getByRole('article', {
      name: 'Released qualitative context',
    });
    await expect(context).toContainText('Qualitative inference');
    await expect(context).toContainText('No quantified impact');
    await expect(context).toContainText(input.content.limitations);
    await expect(
      context.getByRole('link', { name: /source edition/ }),
    ).toHaveAttribute('href', '#read/' + source.id);
    await expect(
      context.getByRole('link', { name: 'Open reviewed context event' }),
    ).toHaveAttribute('href', '#events/' + fixture.eventId);
  } finally {
    await fixture.reviewer.dispose();
  }
});

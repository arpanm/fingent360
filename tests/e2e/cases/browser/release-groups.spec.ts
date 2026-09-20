import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import { publishNamedEvent } from '../../helpers/publish-named-event';
import { seedReleaseSources, releaseInput } from '../../helpers/release-groups';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { EventOperationsSchema } from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-WEB-2300 reviewed group expansion separate releases Back Stories and grouping recovery @UX-002C @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const sources = await seedReleaseSources(feedbackSandbox),
      id = randomUUID();
    expect(
      (
        await request.put(`/api/v1/ops/events/${id}`, {
          headers,
          data: releaseInput(sources.slice(0, 2)),
        })
      ).status(),
    ).toBe(200);
    await publishNamedEvent(
      request,
      reviewer,
      id,
      'Independent synthetic browser group review',
    );
    let failGroups = true;
    await page.route(/\/api\/v1\/(?:discovery|events)(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/release-groups') && failGroups)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic grouping outage' }),
        });
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await expect(
      page.getByText('Release grouping is unavailable.', { exact: false }),
    ).toBeVisible();
    for (const source of sources)
      await expect(
        page.locator(`a.headline-link[data-item-id="${source.id}"]`),
      ).toBeVisible();
    failGroups = false;
    await page.getByRole('button', { name: 'Retry release grouping' }).click();
    const group = page.getByRole('region', {
      name: 'Same event: TEST-SIMULATION: one explicitly reviewed event',
    });
    await expect(group).toBeVisible();
    await expect(
      page.locator(`a.headline-link[data-item-id="${sources[2]!.id}"]`),
    ).toBeVisible();
    const summary = group.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(group.locator('a.headline-link')).toHaveCount(2);
    await expect(group.locator('a.headline-link').last()).toBeVisible();
    const target = await group
      .locator('a.headline-link')
      .last()
      .getAttribute('data-item-id');
    await group.locator('a.headline-link').last().click();
    await expect(page).toHaveURL(new RegExp(`#read/${target}$`));
    await expect(
      page
        .getByRole('heading', { name: sources[0]!.title, exact: true })
        .first(),
    ).toBeVisible();
    await page.goBack();
    await expect(group.locator('details')).toHaveAttribute('open', '');
    await page.getByLabel('Show releases separately').check();
    await expect(group).toHaveCount(0);
    for (const source of sources)
      await expect(
        page.locator(`a.headline-link[data-item-id="${source.id}"]`),
      ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto('/#today?mode=stories');
    await expect(
      page.getByRole('region', { name: 'Reading story' }),
    ).toBeVisible();
    await expect(page.locator('.story-number')).toContainText('/ 3');
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-WEB-2301 Operations explicitly groups and removes exact cited releases @UX-002C @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const sources = await seedReleaseSources(feedbackSandbox);
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Event review');
    const panel = page.getByRole('region', { name: 'Event editorial review' });
    await panel
      .getByRole('button', { name: 'Create event draft', exact: true })
      .click();
    await panel
      .getByLabel('Event title', { exact: true })
      .fill('Synthetic explicitly grouped releases');
    await panel.getByLabel('Event family', { exact: true }).fill('Policy');
    await panel.getByLabel('Claim kind', { exact: true }).selectOption('fact');
    await panel
      .getByLabel('Editorial explanation', { exact: true })
      .fill('Synthetic explicit identity, not a financial claim.');
    for (const [index, source] of sources.slice(0, 2).entries()) {
      await panel
        .getByRole('button', { name: 'Add source excerpt', exact: true })
        .click();
      await panel
        .getByLabel(`Stored published source ${index + 1}`, { exact: true })
        .selectOption(source.id);
    }
    await panel
      .getByLabel('Group these releases as the same event', { exact: true })
      .check();
    await panel
      .getByLabel('Why these releases describe the same event')
      .fill('Both synthetic releases explicitly describe one test event.');
    await panel
      .getByLabel('Draft revision reason', { exact: true })
      .fill('Synthetic explicit grouping selection');
    const savedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/ops\/events\//.test(response.url()),
    );
    await panel
      .getByRole('button', { name: 'Save event draft', exact: true })
      .click();
    const saved = EventOperationsSchema.parse(
      await (await savedResponse).json(),
    );
    expect(saved.latest.editorial.releaseGroup?.sourceIds).toEqual(
      sources.slice(0, 2).map((source) => source.id),
    );
    await panel
      .getByLabel('Group these releases as the same event', { exact: true })
      .uncheck();
    await panel
      .getByLabel('Draft revision reason', { exact: true })
      .fill('Synthetic explicit ungroup selection');
    const removedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/ops\/events\//.test(response.url()),
    );
    await panel
      .getByRole('button', { name: 'Save event draft', exact: true })
      .click();
    expect(
      EventOperationsSchema.parse(await (await removedResponse).json()).latest
        .editorial.releaseGroup,
    ).toBeUndefined();
  } finally {
    await reviewer.dispose();
  }
});

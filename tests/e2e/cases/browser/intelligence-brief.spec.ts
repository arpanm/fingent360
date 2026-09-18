import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  intelligenceBriefFixture,
  headers,
} from '../../helpers/intelligence-brief';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1520 five historical actual-source points expose source sector company navigation and hide withdrawn evidence @DEV-006 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await intelligenceBriefFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    expect(
      (
        await f.reviewer.post(
          `/api/v1/ops/intelligence-briefs/${f.id}/review`,
          {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              decision: 'publish',
              reason: 'Independent five-point historical editorial issue.',
            },
          },
        )
      ).status(),
    ).toBe(201);
    await page.route(
      /\/api\/v1\/(?:intelligence-briefs|events|discovery)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await page.goto('/#intelligence-briefs/' + f.id);
    const panel = page.getByRole('main', { name: 'Intelligence brief' }),
      points = panel
        .getByRole('list', { name: 'Reviewed brief points' })
        .locator(':scope > li');
    await expect(points).toHaveCount(5);
    const first = points.first(),
      details = first.getByText('Sources and context for point 1', {
        exact: true,
      });
    await details.focus();
    await details.press('Enter');
    await expect(
      first.getByRole('link', { name: 'Airlines sector context' }),
    ).toHaveAttribute('href', '#events?sector=Airlines');
    await expect(
      first.getByRole('link', { name: /Company identity/ }),
    ).toHaveAttribute('href', '#securities/INE646L01027');
    await expect(
      first.getByRole('link', { name: 'Company evidence' }),
    ).toHaveAttribute('href', '?equity=INE646L01027#equities');
    await first
      .getByRole('link', { name: 'Open reviewed event', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp('#events/' + f.event.id + '$'));
    await page.goBack();
    await expect(points).toHaveCount(5);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/oil-education/review', {
          headers,
          data: {
            requestId: randomUUID(),
            id: f.source.id.slice('oil-education-'.length),
            decision: 'withdraw',
            reason:
              'Independent source withdrawal for reader recovery acceptance.',
            rightsVerified: false,
          },
        })
      ).status(),
    ).toBe(201);
    await panel
      .getByRole('button', { name: 'Refresh brief', exact: true })
      .click();
    await expect(points.first()).toContainText('Point 1 unavailable');
    await expect(
      points.first().getByRole('link', { name: 'Check current event' }),
    ).toBeVisible();
    await expect(points.first()).not.toContainText(
      f.event.event!.editorial.explanation,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.getByRole('button', { name: 'Issued version history' }).click();
    await expect(panel).toContainText('Version 1');
    await panel.getByRole('link', { name: 'Back to briefs' }).click();
    await expect(page).toHaveURL(/#intelligence-briefs$/);
    const issuedLink = panel.getByRole('link', {
      name: f.input.title,
      exact: true,
    });
    await expect(issuedLink).toBeVisible();
    await expect(panel).toContainText('4 of 5 points currently admitted.');
    const listPath = /\/api\/v1\/intelligence-briefs$/;
    await page.route(listPath, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Brief admission temporarily unavailable.',
        }),
      }),
    );
    await panel
      .getByRole('button', { name: 'Refresh brief', exact: true })
      .click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await expect(issuedLink).toHaveCount(0);
    await expect(panel).not.toContainText('points currently admitted.');
    await page.unroute(listPath);
    await panel
      .getByRole('button', { name: 'Refresh brief', exact: true })
      .click();
    await expect(issuedLink).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await issuedLink.click();
    await expect(points).toHaveCount(5);
    await expect(points.first()).toContainText('Point 1 unavailable');
    await panel.getByRole('link', { name: 'Back to briefs' }).click();
    await expect(issuedLink).toBeVisible();
  } finally {
    await f.reviewer.dispose();
  }
});

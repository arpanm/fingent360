import { test, expect } from '../../helpers/app-fixture';
import { intelligenceBriefFixture } from '../../helpers/intelligence-brief';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1522 actual editorial brief UI prepares independently issues corrects and withdraws @DEV-006 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await intelligenceBriefFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Intelligence briefs',
    );
    let region = page.getByRole('region', {
      name: 'Editorial brief preparation',
      exact: true,
    });
    await region.getByRole('button', { name: 'Start a new brief' }).click();
    await region
      .getByLabel('Brief title', { exact: true })
      .fill('Browser prepared historical five-point brief');
    await region
      .getByLabel('Preparation or correction reason')
      .fill(
        'Browser authored actual source selection with synthetic permissions.',
      );
    for (const event of fixture.events)
      await region
        .locator('label')
        .filter({ hasText: event.event!.editorial.title })
        .getByRole('checkbox')
        .check();
    const prepared = page.waitForResponse(
      (r) =>
        r.url().includes('/ops/intelligence-briefs/') &&
        r.request().method() === 'PUT',
    );
    await region.getByRole('button', { name: 'Save brief draft' }).click();
    expect((await prepared).status()).toBe(200);
    await expect(region).toContainText('Brief draft retained.');
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Intelligence briefs',
    );
    region = page.getByRole('region', {
      name: 'Editorial brief preparation',
      exact: true,
    });
    await region
      .getByLabel('Independent publication or withdrawal reason')
      .fill('Independent browser publication after exact evidence inspection.');
    let card = region.locator('article').filter({
      has: page.getByRole('heading', {
        name: 'Browser prepared historical five-point brief',
        exact: true,
      }),
    });
    await card
      .getByRole('button', { name: 'Independently issue brief' })
      .click();
    await expect(card).toContainText('published version 1');
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Intelligence briefs',
    );
    region = page.getByRole('region', {
      name: 'Editorial brief preparation',
      exact: true,
    });
    card = region.locator('article').filter({
      has: page.getByRole('heading', {
        name: 'Browser prepared historical five-point brief',
        exact: true,
      }),
    });
    await card
      .getByRole('button', { name: 'Prepare corrected version' })
      .click();
    await region
      .getByLabel('Brief title', { exact: true })
      .fill('Corrected browser historical brief');
    await region
      .getByLabel('Preparation or correction reason')
      .fill('Explicit title correction preserves exact prior issued points.');
    await region.getByRole('button', { name: 'Save brief draft' }).click();
    await expect(region).toContainText('Brief draft retained.');
    await sourceOpsBrowser(
      page,
      fixture.reviewer,
      feedbackSandbox,
      'Intelligence briefs',
    );
    region = page.getByRole('region', {
      name: 'Editorial brief preparation',
      exact: true,
    });
    await region
      .getByLabel('Independent publication or withdrawal reason')
      .fill('Independent corrected edition review and subsequent withdrawal.');
    card = region.locator('article').filter({
      has: page.getByRole('heading', {
        name: 'Corrected browser historical brief',
        exact: true,
      }),
    });
    await card
      .getByRole('button', { name: 'Independently issue brief' })
      .click();
    await expect(card).toContainText('published version 2');
    await card.getByRole('button', { name: 'Withdraw brief' }).click();
    await expect(card).toContainText('current state withdrawn');
  } finally {
    await fixture.reviewer.dispose();
  }
});

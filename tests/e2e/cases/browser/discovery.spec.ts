import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  DiscoveryOperationsSchema,
  FeedItemSchema,
  LibrarySchema,
  type FeedItem,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const origin = () => ({
  Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
});
async function ensureReading(api: APIRequestContext) {
  expect(
    (
      await api.post('/api/v1/ops/session', {
        headers: origin(),
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  let state = DiscoveryOperationsSchema.parse(
    await (await api.get('/api/v1/ops/discovery/items')).json(),
  );
  if (state.items.filter((i) => i.kind === 'term').length < 2) {
    const refreshed = await api.post('/api/v1/ops/discovery/refresh', {
      headers: origin(),
      data: { sourceIds: ['glossary'] },
      timeout: 45000,
    });
    expect(refreshed.status(), await refreshed.text()).toBe(201);
    state = DiscoveryOperationsSchema.parse(
      await (await api.get('/api/v1/ops/discovery/items')).json(),
    );
  }
  const items: FeedItem[] = [];
  const changed: FeedItem[] = [];
  for (const candidate of state.items
    .filter((i) => i.kind === 'term')
    .slice(0, 2)) {
    const current = await api.get(`/api/v1/discovery/items/${candidate.id}`);
    if (current.ok()) {
      const published = FeedItemSchema.parse(await current.json());
      if (published.status === 'published') {
        items.push(published);
        continue;
      }
    }
    const response = await api.put(
      `/api/v1/ops/discovery/items/${candidate.id}`,
      {
        headers: origin(),
        data: {
          expectedVersion: candidate.version,
          status: 'published',
          correctionNote:
            'Acceptance review of authored educational term for reader workflow.',
        },
      },
    );
    expect(response.status()).toBe(200);
    const item = FeedItemSchema.parse(await response.json());
    items.push(item);
    changed.push(item);
  }
  expect(items).toHaveLength(2);
  return {
    items,
    cleanup: async () => {
      for (const item of changed) {
        const latest = DiscoveryOperationsSchema.parse(
          await (await api.get('/api/v1/ops/discovery/items')).json(),
        ).items.find((i) => i.id === item.id);
        if (latest?.version === item.version)
          await api.put(`/api/v1/ops/discovery/items/${item.id}`, {
            headers: origin(),
            data: {
              expectedVersion: item.version,
              status: 'withdrawn',
              correctionNote:
                'Acceptance cleanup of previously unpublished term.',
            },
          });
      }
      await api.delete('/api/v1/ops/session', { headers: origin() });
    },
  };
}
test('E2E-WEB-130 explore actual reading, open history and return to filtered scan @UX-002', async ({
  page,
}) => {
  test.setTimeout(90000);
  const setup = await ensureReading(page.request);
  try {
    const item = setup.items[0]!;
    await page.goto('/#explore');
    await page.getByLabel('Search topics and reading').fill(item.title);
    await page.getByRole('button', { name: 'Terms', exact: true }).click();
    await page.locator(`a.headline-link[data-item-id="${item.id}"]`).click();
    await expect(
      page.getByRole('heading', { name: item.title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Version history', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    await expect(
      dialog.getByText(item.title, { exact: true }).first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/#explore(?:\?|$)/);
    await expect(page.getByLabel('Search topics and reading')).toHaveValue(
      item.title,
    );
    await expect(
      page.getByRole('button', { name: 'Terms', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const size = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(size.page).toBeLessThanOrEqual(size.viewport);
  } finally {
    await setup.cleanup();
  }
});
test('E2E-WEB-131 saved reading, reaction undo and persisted reminder @UX-002', async ({
  page,
}) => {
  test.setTimeout(90000);
  const setup = await ensureReading(page.request);
  const password = 'E2E-reader-only-passphrase-2026';
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers: origin(),
        data: {
          username: `e2e_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    const item = setup.items[0]!;
    const libraryReady = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/account/library') &&
        response.request().method() === 'GET' &&
        response.ok(),
    );
    await page.goto(`/#read/${item.id}`);
    await libraryReady;
    await expect(
      page.getByRole('heading', { name: item.title, exact: true }),
    ).toBeVisible();
    const actions = page.locator('.reader-actions');
    await actions.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      actions.getByRole('button', { name: 'Saved', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page
      .locator('.reader-notice')
      .getByRole('button', { name: 'Undo' })
      .click();
    await expect(
      actions.getByRole('button', { name: 'Save', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await actions
      .getByRole('button', { name: 'More like this', exact: true })
      .click();
    await expect(
      actions.getByRole('button', { name: 'More like this', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page
      .locator('.reader-notice')
      .getByRole('button', { name: 'Undo' })
      .click();
    await expect(
      actions.getByRole('button', { name: 'More like this', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await actions
      .getByRole('button', { name: 'Remind me', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Remind me to read' });
    const localDate = new Date(Date.now() + 86400000);
    const due = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}T12:00`;
    await dialog.getByLabel('When to read').fill(due);
    await dialog.getByRole('button', { name: 'Save reminder' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.reader-notice')).toContainText(
      'Reminder saved',
    );
    await page.reload();
    const library = LibrarySchema.parse(
      await (await page.request.get('/api/v1/account/library')).json(),
    );
    expect(library.reminders.some((r) => r.itemId === item.id)).toBe(true);
    expect(library.saved.some((s) => s.itemId === item.id)).toBe(false);
    expect(library.reactions.some((r) => r.itemId === item.id)).toBe(false);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers: origin(),
      data: { password },
    });
    await setup.cleanup();
  }
});
test('E2E-WEB-132 stories controls, view persistence and responsive navigation @UX-002', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90000);
  const setup = await ensureReading(page.request);
  try {
    await page.goto('/#explore');
    await page.getByRole('button', { name: 'Terms', exact: true }).click();
    await page.getByRole('button', { name: 'Stories', exact: true }).click();
    const stage = page.locator('.story-stage');
    const first = await stage.getByRole('heading').textContent();
    await stage.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(stage.getByRole('heading')).not.toHaveText(first!);
    await stage.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(stage.getByRole('heading')).toHaveText(first!);
    const swipeArea = stage.locator('.story-swipe-area');
    await swipeArea.scrollIntoViewIfNeeded();
    const box = (await swipeArea.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height - 8;
    if (isMobile) {
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
      });
      for (let offset = 20; offset <= 100; offset += 20)
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - offset }],
        });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await touch.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 100, { steps: 5 });
      await page.mouse.up();
    }
    await expect(stage.getByRole('heading')).not.toHaveText(first!);
    await stage.getByRole('button', { name: 'Previous', exact: true }).click();
    await stage.getByRole('link', { name: /Read the story/ }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Stories', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(stage.getByRole('heading')).toHaveText(first!);
    const nav = page.getByRole('navigation', {
      name: isMobile ? 'Mobile navigation' : 'Product areas',
    });
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page).toHaveURL(/#today$/);
    await nav.getByRole('link', { name: 'Explore', exact: true }).click();
    await expect(page).toHaveURL(/#explore\?kind=term&mode=stories$/);
    const size = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(size.page).toBeLessThanOrEqual(size.viewport);
  } finally {
    await setup.cleanup();
  }
});

import { test, expect, type Page } from '@playwright/test';

async function holdFeedbackStorage(page: Page) {
  // Hold only the real feedback database's open notification. No settings,
  // reports or API responses are fabricated; the normal IndexedDB store is used.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('feedback-loading-fixture-released')) return;
    const open = IDBFactory.prototype.open;
    const pending: ((fail: boolean) => void)[] = [];
    let released = false;
    Object.assign(window, {
      feedbackStorageHeld: false,
      releaseFeedbackStorage: (fail = false) => {
        released = true;
        sessionStorage.setItem('feedback-loading-fixture-released', 'true');
        pending.splice(0).forEach((notify) => notify(fail));
      },
    });
    IDBFactory.prototype.open = function (name: string, version?: number) {
      const request =
        version === undefined
          ? open.call(this, name)
          : open.call(this, name, version);
      if (name !== 'fingent360-feedback') return request;
      Object.defineProperty(request, 'onsuccess', {
        set(listener: ((this: IDBRequest, event: Event) => unknown) | null) {
          if (!listener) return;
          request.addEventListener('success', (event) => {
            if (released) listener.call(request, event);
            else {
              Object.assign(window, { feedbackStorageHeld: true });
              pending.push((fail) => {
                if (fail) {
                  request.result.close();
                  request.onerror?.call(request, new Event('error'));
                } else listener.call(request, event);
              });
            }
          });
        },
      });
      return request;
    };
  });
}
async function releaseFeedbackStorage(page: Page, fail = false) {
  await page.evaluate(
    (fail) =>
      (
        window as unknown as {
          releaseFeedbackStorage?: (fail: boolean) => void;
        }
      ).releaseFeedbackStorage?.(fail),
    fail,
  );
}
async function expectStorageHeld(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { feedbackStorageHeld: boolean })
            .feedbackStorageHeld,
      ),
    )
    .toBe(true);
  await expect(
    page.getByText('Opening saved feedback…', { exact: true }),
  ).toBeVisible();
}

test('E2E-WEB-196 delayed local storage never exposes placeholder delivery settings @FEEDBACK-001 @UI-RACES-001 @simulated', async ({
  page,
}) => {
  await holdFeedbackStorage(page);
  try {
    await page.goto('/#feedback');
    await expectStorageHeld(page);
    const delivery = page.getByLabel(
      'Automatically deliver submitted feedback',
      { exact: true },
    );
    // An unchecked placeholder can make uncheck() return before the true saved
    // value arrives, even when that placeholder is disabled.
    await expect(delivery).toHaveCount(0);
    await releaseFeedbackStorage(page);
    await expect(delivery).toBeEnabled();
    await expect(delivery).toBeChecked();
    const origin = await page
      .getByLabel('Feedback API URL', { exact: true })
      .inputValue();
    await delivery.uncheck();
    await page
      .getByRole('button', {
        name: 'Save feedback delivery settings',
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        'Feedback delivery paused. Reports remain on this device.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(delivery).toBeEnabled();
    await expect(delivery).not.toBeChecked();
    await expect(
      page.getByLabel('Feedback API URL', { exact: true }),
    ).toHaveValue(origin);
  } finally {
    await releaseFeedbackStorage(page).catch(() => {});
  }
});

test('E2E-WEB-197 failed local storage shows recovery without exposing unsaved delivery settings @FEEDBACK-001 @UI-RACES-001 @simulated', async ({
  page,
}) => {
  await holdFeedbackStorage(page);
  try {
    await page.goto('/#feedback');
    await expectStorageHeld(page);
    await releaseFeedbackStorage(page, true);
    await expect(page.getByRole('alert')).toContainText(
      'Feedback storage could not open',
    );
    const delivery = page.getByLabel(
      'Automatically deliver submitted feedback',
      { exact: true },
    );
    await expect(delivery).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Check delivery', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', {
        name: 'Save feedback delivery settings',
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Retry opening feedback', exact: true })
      .click();
    await expect(delivery).toBeEnabled();
    await expect(delivery).toBeChecked();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await delivery.uncheck();
    await page
      .getByRole('button', {
        name: 'Save feedback delivery settings',
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        'Feedback delivery paused. Reports remain on this device.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(delivery).toBeEnabled();
    await expect(delivery).not.toBeChecked();
  } finally {
    await releaseFeedbackStorage(page).catch(() => {});
  }
});

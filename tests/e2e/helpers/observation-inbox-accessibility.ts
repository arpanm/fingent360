import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

// Exercise the actual tab order, including recovery after an async control
// disables itself. Programmatic focus would conceal unreachable controls.
export async function tabToObservationControl(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let step = 0; step < 180; step++) {
    if (await target.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

export async function activateObservationControl(
  page: Page,
  target: Locator,
  key: 'Enter' | 'Space' = 'Enter',
) {
  await tabToObservationControl(page, target);
  await page.keyboard.press(key);
}

export async function captureObservationLayout(
  page: Page,
  region: Locator,
  testInfo: TestInfo,
  name: string,
  mask: Locator[] = [],
) {
  await expect(region).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const bounds = await region.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  expect(
    await region.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const controls = region.locator('a, button');
  for (let index = 0; index < (await controls.count()); index++) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
  // Caller restricts capture to synthetic inbox cards or static preferences.
  // Never capture the signed-in account heading, login form, or entire inbox
  // containing unrelated private modules. Bundled observation text is masked.
  await testInfo.attach(name, {
    body: await region.screenshot({
      animations: 'disabled',
      mask: [...mask, region.locator('input, textarea')],
    }),
    contentType: 'image/png',
  });
}

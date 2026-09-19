import { expect, type Locator } from '@playwright/test';

// toBeVisible alone permits a focused control behind fixed page furniture.
// Inspect actual viewport hit targets without moving or focusing the control.
export async function expectUnobscuredControl(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        if (
          box.width <= 0 ||
          box.height <= 0 ||
          box.left < 0 ||
          box.top < 0 ||
          box.right > innerWidth ||
          box.bottom > innerHeight
        )
          return false;
        return [0.1, 0.5, 0.9].every((horizontal) =>
          [0.1, 0.5, 0.9].every((vertical) => {
            const hit = document.elementFromPoint(
              box.left + box.width * horizontal,
              box.top + box.height * vertical,
            );
            return hit !== null && (hit === element || element.contains(hit));
          }),
        );
      }),
    )
    .toBe(true);
}

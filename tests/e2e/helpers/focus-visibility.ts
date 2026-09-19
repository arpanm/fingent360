import { expect, type Locator } from '@playwright/test';

// toBeVisible alone permits a focused control behind fixed page furniture.
// Inspect actual viewport hit targets without moving or focusing the control.
export async function expectUnobscuredControl(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        // A wrapped inline link has several painted line fragments. Its union
        // bounding box includes blank space that belongs to its parent, not the
        // link. Keep the same nine-point hit test on every actual fragment.
        const fragments = Array.from(element.getClientRects()).filter(
          (box) => box.width > 0 && box.height > 0,
        );
        const rects = fragments.map((box) => {
          const insideViewport =
            box.left >= 0 &&
            box.top >= 0 &&
            box.right <= innerWidth &&
            box.bottom <= innerHeight;
          const points = [0.1, 0.5, 0.9].flatMap((horizontal) =>
            [0.1, 0.5, 0.9].map((vertical) => {
              const x = box.left + box.width * horizontal;
              const y = box.top + box.height * vertical;
              const hit = document.elementFromPoint(x, y);
              return {
                x,
                y,
                matches:
                  hit !== null && (hit === element || element.contains(hit)),
                // Structural diagnostics only: never include private text,
                // form values, URLs, IDs, classes or surrounding DOM markup.
                hitTag: hit?.tagName ?? null,
                hitRole: hit?.getAttribute('role') ?? null,
              };
            }),
          );
          return {
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.bottom,
            insideViewport,
            failedPoints: points.filter((point) => !point.matches),
          };
        });
        return {
          unobscured:
            rects.length > 0 &&
            rects.every(
              (rect) => rect.insideViewport && rect.failedPoints.length === 0,
            ),
          targetTag: element.tagName,
          display: getComputedStyle(element).display,
          viewport: { width: innerWidth, height: innerHeight },
          rects,
        };
      }),
    )
    .toMatchObject({ unobscured: true });
}

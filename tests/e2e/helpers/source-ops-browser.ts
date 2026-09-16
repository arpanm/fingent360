import type { APIRequestContext, Page } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { retentionHeaders } from './retention';
/** Forward UI HTTP requests to real isolated API with the selected real named actor's cookie. */
export async function sourceOpsBrowser(
  page: Page,
  actor: APIRequestContext,
  sandbox: FeedbackSandbox,
  tab: string,
) {
  const saved = await actor.storageState();
  const cookie = saved.cookies.map((v) => `${v.name}=${v.value}`).join(';');
  await page.unroute('**/api/v1/ops/**');
  await page.route('**/api/v1/ops/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: sandbox.apiOrigin + url.pathname + url.search,
      headers: { ...route.request().headers(), ...retentionHeaders, cookie },
    });
  });
  await page.goto('/#today');
  await page.goto('/#ops');
  await page.getByRole('button', { name: tab, exact: true }).click();
}

import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { OperatorSessionSchema } from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
import { retentionHeaders } from './retention';
/** Switch the real browser session to the selected authenticated actor. */
export async function sourceOpsBrowser(
  page: Page,
  actor: APIRequestContext,
  sandbox: FeedbackSandbox,
  tab: string,
) {
  const saved = await actor.storageState();
  const cookie = saved.cookies.find((value) => value.name === 'f360_ops');
  if (!cookie)
    throw Error('Source workflow requires an authenticated operator.');
  const expectedSession = OperatorSessionSchema.parse(
    await (await actor.get('/api/v1/ops/session')).json(),
  );
  expect(expectedSession.authenticated).toBe(true);
  await page.goto('/#today');
  const origin = new URL(page.url());
  // Cookie headers cannot switch the browser cookie jar through route.continue.
  // Keep private account cookies intact; replace only the Operations session.
  await page.context().clearCookies({ name: 'f360_ops' });
  await page.context().addCookies([
    {
      ...cookie,
      domain: origin.hostname,
      secure: origin.protocol === 'https:',
    },
  ]);
  await page.unroute('**/api/v1/ops/**');
  await page.route('**/api/v1/ops/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: sandbox.apiOrigin + url.pathname + url.search,
      headers: { ...route.request().headers(), ...retentionHeaders },
    });
  });
  const sessionResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/ops/session' &&
      response.request().method() === 'GET',
  );
  await page.goto('/#ops');
  const response = await sessionResponse;
  expect(response.status()).toBe(200);
  const actualSession = OperatorSessionSchema.parse(await response.json());
  expect(actualSession.authenticated).toBe(true);
  expect(actualSession.identity).toEqual(expectedSession.identity);
  await page.getByRole('button', { name: tab, exact: true }).click();
}

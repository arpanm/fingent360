import { test, expect, eventFixture } from '../../helpers/event-fixture';

test('E2E-WEB-1255 public reading sharing excludes private URL context and opens a user-controlled share handoff @DEV-029 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  const f = await eventFixture(request, feedbackSandbox);
  const webOrigin = new URL(baseURL!).origin;
  // Simulate only public hosting/OS share capability; application content and APIs stay real.
  await page.route('https://reader.example.org/**', async (route) => {
    const url = new URL(route.request().url());
    const target = url.pathname.startsWith('/api/v1/')
      ? feedbackSandbox.apiOrigin
      : webOrigin;
    const response = await route.fetch({
      url: target + url.pathname + url.search,
      // The synthetic host forwards the dev module graph. Retry only reset
      // connections for safe reads; never replay a reader/account mutation.
      maxRetries: route.request().method() === 'GET' ? 1 : 0,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        sessionStorage.setItem('synthetic-share', JSON.stringify(data));
      },
    });
  });
  await page.goto(
    'https://reader.example.org/?privateContext=do-not-share#read/' +
      f.source.id,
  );
  await page
    .getByRole('button', { name: 'More item actions', exact: true })
    .click();
  const share = page.getByRole('region', {
    name: 'Share public reading',
    exact: true,
  });
  await expect(share.getByLabel('Public reading link')).toHaveValue(
    'https://reader.example.org/#read/' + f.source.id,
  );
  await share
    .getByRole('button', { name: 'Share public link', exact: true })
    .click();
  const handed = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('synthetic-share') || 'null'),
  );
  expect(handed).toEqual({
    title: 'Fingent360 public reading',
    url: 'https://reader.example.org/#read/' + f.source.id,
  });
  await expect(share).toContainText(
    'Link handed to your selected share destination.',
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Cancelled', 'AbortError');
      },
    });
  });
  await share
    .getByRole('button', { name: 'Share public link', exact: true })
    .click();
  await expect(share).toContainText('Sharing cancelled.');
  await expect(
    share.getByRole('button', { name: 'Copy link', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Synthetic share denied', 'NotAllowedError');
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException(
            'Synthetic clipboard denied',
            'NotAllowedError',
          );
        },
      },
    });
  });
  await share
    .getByRole('button', { name: 'Share public link', exact: true })
    .click();
  await expect(share).toContainText(
    'Sharing is unavailable. You can still copy the public link.',
  );
  await share.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(share).toContainText(
    'Copy is unavailable. Select and copy the public link below.',
  );
  const publicLink = share.getByLabel('Public reading link');
  await expect(publicLink).toHaveValue(
    'https://reader.example.org/#read/' + f.source.id,
  );
  await publicLink.focus();
  expect(
    await publicLink.evaluate((input: HTMLInputElement) =>
      input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
    ),
  ).toBe('https://reader.example.org/#read/' + f.source.id);
});

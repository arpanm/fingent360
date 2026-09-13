import { FeedbackSubmissionSchema } from '../../../../packages/contracts/src/index';
import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-230 feedback-only submission persists separately across reload and remains private while disabled @FEEDBACK-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.includes('/api/v1/feedback'))
      network.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer
    .getByLabel('Your feedback', { exact: true })
    .fill('Offline feedback fixture: improve source dates.');
  await expect(
    composer.getByRole('button', { name: 'Submit feedback', exact: true }),
  ).toBeDisabled();
  await composer
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await composer
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'View feedback', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your feedback', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Offline feedback fixture: improve source dates.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Pending delivery', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Offline feedback fixture: improve source dates.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Automatically deliver submitted feedback', {
      exact: true,
    }),
  ).not.toBeChecked();
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-231 feedback settings reject unsafe destinations and retain disabled configuration @FEEDBACK-001', async ({
  page,
}) => {
  await page.goto('/#feedback');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByLabel('Feedback API URL', { exact: true })
    .fill('http://untrusted.example');
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(page.getByRole('alert')).toContainText(/HTTPS/);
  await page
    .getByLabel('Feedback API URL', { exact: true })
    .fill('https://feedback.example');
  await page
    .getByLabel('Automatically deliver submitted feedback', { exact: true })
    .uncheck();
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(
    page.getByText('Feedback delivery paused. Reports remain on this device.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel('Feedback API URL', { exact: true }),
  ).toHaveValue('https://feedback.example');
  await expect(
    page.getByLabel('Automatically deliver submitted feedback', {
      exact: true,
    }),
  ).not.toBeChecked();
});

test('E2E-OFFLINE-232 cancelling consent never queues or delivers a report @FEEDBACK-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer
    .getByLabel('Your feedback', { exact: true })
    .fill('Cancelled feedback fixture, never submitted.');
  await composer.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Discard this feedback draft?' })
    .getByRole('button', { name: 'Discard draft', exact: true })
    .click();
  await page.goto('/#feedback');
  await expect(
    page.getByRole('heading', { name: 'Your feedback', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Cancelled feedback fixture, never submitted.', {
      exact: true,
    }),
  ).toHaveCount(0);
});

const simulatedOrigin = 'https://feedback.example';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type,x-feedback-token',
};
async function enableFixtureDelivery(page: import('@playwright/test').Page) {
  await page.goto('/#feedback');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByLabel('Feedback API URL', { exact: true })
    .fill(simulatedOrigin);
  await page
    .getByLabel('Automatically deliver submitted feedback', { exact: true })
    .check();
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      'Feedback delivery enabled. Submitted reports will retry while the app is open.',
      { exact: true },
    ),
  ).toBeVisible();
}
async function queueFixture(
  page: import('@playwright/test').Page,
  text: string,
) {
  await page.goto('/#today');
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const composer = page.getByRole('dialog', { name: 'Share feedback' });
  await composer.getByLabel('Your feedback', { exact: true }).fill(text);
  await composer
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  await composer
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Saved on this device' })
    .getByRole('link', { name: 'View feedback', exact: true })
    .click();
}

test('E2E-OFFLINE-233 simulated terminal POST error cannot strand concurrent deletion @FEEDBACK-001 @simulated', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false,
    deletes = 0;
  await page.route(
    /^https:\/\/feedback\.example\/api\/v1\/feedback(?:\/.*)?$/,
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      if (route.request().method() === 'POST') {
        started = true;
        await pending;
        await route.fulfill({
          status: 409,
          headers: cors,
          json: { message: 'Synthetic terminal POST conflict' },
        });
        return;
      }
      if (route.request().method() === 'DELETE') {
        deletes++;
        await route.fulfill({
          status: 200,
          headers: cors,
          json: { deleted: true },
        });
        return;
      }
      await route.fulfill({
        status: 404,
        headers: cors,
        json: { message: 'Synthetic fixture route' },
      });
    },
  );
  try {
    await enableFixtureDelivery(page);
    await queueFixture(page, 'Synthetic concurrent deletion fixture');
    await expect.poll(() => started).toBe(true);
    const card = page
      .getByRole('article')
      .filter({ hasText: 'Synthetic concurrent deletion fixture' });
    await card
      .getByRole('button', { name: 'Delete feedback', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete this feedback?' })
      .getByRole('button', { name: 'Confirm deletion', exact: true })
      .click();
    await expect(card.getByText('Deleting', { exact: true })).toBeVisible();
    release();
    await expect(card).toHaveCount(0);
    expect(deletes).toBe(1);
  } finally {
    release();
  }
});

test('E2E-OFFLINE-234 out-of-order simulated receipt checks cannot downgrade a newer version @FEEDBACK-001 @simulated', async ({
  page,
  context,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submitted: ReturnType<typeof FeedbackSubmissionSchema.parse> | undefined;
  let gets = 0,
    receipt:
      | {
          id: string;
          status: string;
          receivedAt: string;
          updatedAt: string;
          version: number;
        }
      | undefined;
  await context.route(
    /^https:\/\/feedback\.example\/api\/v1\/feedback(?:\/.*)?$/,
    async (route) => {
      const method = route.request().method();
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      if (method === 'POST') {
        const body = FeedbackSubmissionSchema.parse(
          route.request().postDataJSON(),
        );
        submitted = body;
        receipt = {
          id: body.id,
          status: 'received',
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        await route.fulfill({ status: 201, headers: cors, json: receipt });
        return;
      }
      if (method === 'GET') {
        gets++;
        if (gets === 1) {
          await pending;
          await route.fulfill({
            status: 200,
            headers: cors,
            json: {
              ...receipt,
              text: submitted!.text,
              context: submitted!.context,
              image: submitted!.image,
              audio: submitted!.audio,
            },
          });
        } else
          await route.fulfill({
            status: 200,
            headers: cors,
            json: {
              ...receipt,
              text: submitted!.text,
              context: submitted!.context,
              image: submitted!.image,
              audio: submitted!.audio,
              status: 'reviewing',
              version: 2,
            },
          });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: cors,
        json: { deleted: true },
      });
    },
  );
  const second = await context.newPage();
  try {
    await page.bringToFront();
    await enableFixtureDelivery(page);
    await queueFixture(page, 'Synthetic receipt ordering fixture');
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: 'Synthetic receipt ordering fixture' })
        .getByText('Received', { exact: true }),
    ).toBeVisible();
    await second.goto('/#feedback');
    await expect(
      second.getByRole('heading', { name: 'Your feedback', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Check delivery', exact: true })
      .click();
    await expect.poll(() => gets).toBe(1);
    await second.bringToFront();
    await second
      .getByRole('button', { name: 'Check delivery', exact: true })
      .click();
    await expect(
      second.getByText('Being reviewed', { exact: true }),
    ).toBeVisible();
    release();
    await expect(
      page.getByText(
        'Delivery checked. Pending reports stay saved until acknowledged.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Being reviewed', { exact: true }),
    ).toBeVisible();
  } finally {
    release();
    await second.close();
  }
});

test('E2E-OFFLINE-235 another tab observes queue updates through payload-free invalidation @FEEDBACK-001', async ({
  page,
  context,
}) => {
  await page.goto('/#feedback');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const second = await context.newPage();
  await second.goto('/#feedback');
  await expect(
    second.getByRole('heading', { name: 'Your feedback', exact: true }),
  ).toBeVisible();
  const signal = second.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const channel = new BroadcastChannel('fingent360-feedback-changes');
        channel.onmessage = (event) => {
          channel.close();
          resolve(event.data);
        };
      }),
  );
  try {
    await page.bringToFront();
    await queueFixture(page, 'Cross-tab unsent feedback fixture');
    expect(await signal).toBe('changed');
    await expect(
      second.getByText('Cross-tab unsent feedback fixture', { exact: true }),
    ).toBeVisible();
    const card = page
      .getByRole('article')
      .filter({ hasText: 'Cross-tab unsent feedback fixture' });
    await card
      .getByRole('button', { name: 'Delete feedback', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Confirm deletion', exact: true })
      .click();
    await expect(
      second.getByText('Cross-tab unsent feedback fixture', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await second.close();
  }
});

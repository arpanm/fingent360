import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const password = 'Synthetic-learning-tests-2026';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test('E2E-WEB-140 glossary quiz feedback and learning poll persist @UX-002 @LEARN-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `learn_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.goto('/#learning');
    await page
      .getByRole('checkbox', { name: /I agree to store my quiz/ })
      .check();
    const quiz = page.getByRole('article', {
      name: 'Know the identifier',
      exact: true,
    });
    await quiz
      .getByRole('radio', {
        name: 'Your personal brokerage account',
        exact: true,
      })
      .check();
    await quiz
      .getByRole('button', { name: 'Check my answer', exact: true })
      .click();
    await expect(quiz).toContainText('A useful distinction');
    await expect(quiz).toContainText('An ISIN identifies a security.');
    await quiz
      .getByRole('radio', {
        name: 'A security or investment instrument',
        exact: true,
      })
      .check();
    await quiz
      .getByRole('button', { name: 'Check my answer', exact: true })
      .click();
    await expect(quiz).toContainText('That’s right');
    const poll = page.getByRole('article', {
      name: 'What would you like to understand?',
      exact: true,
    });
    await poll
      .getByRole('radio', { name: 'Planning for a goal', exact: true })
      .check();
    await poll
      .getByRole('button', { name: 'Save my preference', exact: true })
      .click();
    await expect(poll).toContainText(
      'Your saved preference: Planning for a goal',
    );
    await expect(
      poll.getByRole('region', { name: 'Topic preference results' }),
    ).toContainText('participating');
    await page.reload();
    await expect(quiz).toContainText('That’s right');
    await expect(poll).toContainText(
      'Your saved preference: Planning for a goal',
    );
    await quiz.getByText('Read the glossary context', { exact: true }).click();
    await expect(quiz).toContainText('glossary-dev001-v1');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
test('E2E-WEB-064 goal wizard preserves back steps and requires Apply for prior plan @UX-002 @ASSIST-001', async ({
  page,
}) => {
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `assist_${randomUUID().slice(0, 15)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    expect(
      (
        await page.request.post('/api/v1/account/goals', {
          headers,
          data: {
            name: 'Synthetic old plan',
            type: 'education',
            targetMinor: '10000000',
            savedMinor: '0',
            monthlyMinor: '12345',
            horizonMonths: 24,
            currency: 'INR',
            scale: 2,
            assumptions: 'no-growth-nominal-v1',
            storageConsent: true,
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#my-goals');
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic new plan');
    await page
      .getByRole('button', { name: 'Next: amounts', exact: true })
      .click();
    await page
      .getByLabel('Target amount (INR)', { exact: true })
      .fill('9999.99');
    await page
      .getByRole('button', { name: 'Back a step', exact: true })
      .click();
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Synthetic new plan',
    );
    await page
      .getByRole('button', { name: 'Next: amounts', exact: true })
      .click();
    await expect(
      page.getByLabel('Target amount (INR)', { exact: true }),
    ).toHaveValue('9999.99');
    await page
      .getByRole('button', { name: 'Next: contributions', exact: true })
      .click();
    await expect(
      page.getByLabel('Monthly contribution (INR)', { exact: true }),
    ).toHaveValue('0.00');
    await page
      .getByRole('button', { name: 'Apply previous plan', exact: true })
      .click();
    await expect(
      page.getByLabel('Monthly contribution (INR)', { exact: true }),
    ).toHaveValue('123.45');
    await expect(
      page.getByLabel('Months from this plan', { exact: true }),
    ).toHaveValue('24');
    await page
      .getByRole('button', { name: 'Review goal', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Goal review' }),
    ).toContainText('Synthetic new plan');
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Add saved goal', exact: true })
      .click();
    await expect(
      page.getByRole('article', { name: 'Goal Synthetic new plan' }),
    ).toContainText('123.45');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
test('E2E-WEB-094 holding wizard keeps amounts on Back and Apply reuses saved record @UX-002 @ASSIST-001', async ({
  page,
}) => {
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `assist_${randomUUID().slice(0, 15)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    const response = await page.request.post(
      '/api/v1/account/holdings/preview',
      {
        headers,
        data: {
          csv: 'isin,quantity,total_cost_paise\nINE002A01018,2.000001,12345',
          expectedVersion: 0,
          storageConsent: true,
        },
      },
    );
    expect(response.status()).toBe(201);
    const preview = (await response.json()) as { previewId: string };
    expect(
      (
        await page.request.post('/api/v1/account/holdings/confirm', {
          headers,
          data: { previewId: preview.previewId, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#holdings');
    await expect(page.getByLabel('Security ISIN', { exact: true })).toHaveValue(
      '',
    );
    await page
      .getByRole('button', { name: 'Apply previous holding', exact: true })
      .click();
    await expect(
      page.getByLabel('Total purchase cost (INR)', { exact: true }),
    ).toHaveValue('123.45');
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('200.01');
    await page
      .getByRole('button', { name: 'Back a step', exact: true })
      .click();
    await expect(page.getByLabel('Security ISIN', { exact: true })).toHaveValue(
      'INE002A01018',
    );
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click();
    await expect(
      page.getByLabel('Total purchase cost (INR)', { exact: true }),
    ).toHaveValue('200.01');
    await page
      .getByRole('button', { name: 'Review this holding', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Holding row review' }),
    ).toContainText('200.01');
    await page
      .getByRole('button', { name: 'Update draft holding', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Draft holdings' }),
    ).toContainText('200.01');
    await expect(
      page.getByRole('region', { name: 'Saved holdings' }),
    ).toContainText('123.45');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-065 dirty goal survives cancelled tab departure and accepts explicit discard @UX-002', async ({
  page,
  isMobile,
}) => {
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `guard_${randomUUID().slice(0, 15)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.goto('/#my-goals');
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic unsaved goal');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('navigation', {
        name: isMobile ? 'Mobile navigation' : 'Product areas',
        exact: true,
      })
      .getByRole('link', { name: 'More', exact: true })
      .click();
    await expect(page).toHaveURL(/#my-goals$/);
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Synthetic unsaved goal',
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('navigation', {
        name: isMobile ? 'Mobile navigation' : 'Product areas',
        exact: true,
      })
      .getByRole('link', { name: 'More', exact: true })
      .click();
    await expect(page).toHaveURL(/#more$/);
  } finally {
    page.on('dialog', (dialog) => dialog.dismiss());
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

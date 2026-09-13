import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { LearningStateSchema } from '../../../../packages/contracts/src/index';
const password = 'Source-learning-fixture-2026';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test('E2E-WEB-170 source-backed learning persists and connects to published research @SOURCES-002', async ({
  page,
}) => {
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `source_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.goto('/#learning?question=inflation-basics');
    const question = page.getByRole('article', {
      name: 'Prices and purchasing power',
      exact: true,
    });
    await expect(question).toBeFocused();
    await page
      .getByRole('checkbox', { name: /I agree to store my quiz/ })
      .check();
    await question
      .getByRole('radio', { name: 'The same budget buys less', exact: true })
      .check();
    await question
      .getByRole('button', { name: 'Check my answer', exact: true })
      .click();
    await expect(question).toContainText('That’s right');
    await expect(
      question.getByRole('link', {
        name: 'ECB · What is inflation?',
        exact: true,
      }),
    ).toHaveAttribute(
      'href',
      'https://www.ecb.europa.eu/ecb-and-you/explainers/tell-me-more/html/what_is_inflation.en.html',
    );
    const related = question.getByRole('region', {
      name: 'Reading for Prices and purchasing power',
    });
    await expect(
      related.getByRole('link', { name: 'Explore this topic' }),
    ).toHaveAttribute('href', /#explore\?topic=Inflation/);
    await page.reload();
    await expect(question).toContainText('That’s right');
    const progress = LearningStateSchema.parse(
      await (await page.request.get('/api/v1/account/learning/state')).json(),
    );
    expect(
      progress.attempts.filter((a) => a.questionId === 'inflation-basics'),
    ).toHaveLength(1);
    await page.goto('/#brief');
    await expect(
      page.getByText('Synthetic learning workspace.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Read real research', exact: true }),
    ).toContainText('does not update or validate the fictional scenario');
    await page.goto('/#overview');
    await expect(
      page.getByRole('region', { name: 'Reading for your next step' }),
    ).toContainText('General investing basics');
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

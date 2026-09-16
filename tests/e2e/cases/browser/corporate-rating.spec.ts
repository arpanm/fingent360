import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import {
  corporateRatingInput,
  corporateRatingReview,
  corporateRatingOriginal,
} from '../../helpers/corporate-rating';
import { fileURLToPath } from 'node:url';
test.use({ namedOperators: true });
test('E2E-WEB-1960 actual ICRA rating reader filters ISIN and labels historical agency withdrawal without price claims @SRC-018', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = await corporateRatingInput();
    expect(
      (
        await request.post('/api/v1/ops/corporate-ratings/import', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + input.requestId + '/review',
          { headers, data: corporateRatingReview() },
        )
      ).status(),
    ).toBe(201);
    await page.route(/\/api\/v1\/corporate-ratings(?:[/?]|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await page.goto('/#funds-bonds');
    const region = page.getByRole('region', {
      name: 'Corporate rating history',
    });
    await region
      .getByLabel('Instrument rating filter')
      .selectOption('INE031A08848');
    await expect(
      region.getByRole('region', { name: 'Rating INE031A08848' }),
    ).toContainText('Withdrawn by ICRA');
    await expect(
      region.getByRole('region', { name: 'Rating INE031A08939' }),
    ).toHaveCount(0);
    await region
      .getByText('Rating original and version', { exact: true })
      .click();
    await expect(
      region.getByRole('link', { name: 'Original ICRA rationale' }),
    ).toHaveAttribute('href', /id=142975/);
    await expect(region).toContainText('2026-03-31');
    await expect(region).toContainText('not a default declaration');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1961 actual licensed PDF Operations capture exposes separate independent publication @SRC-018', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { sourceOpsBrowser } = await import('../../helpers/source-ops-browser');
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Corporate ratings');
  const region = page.getByRole('region', {
    name: 'Corporate rating Operations',
  });
  await region
    .getByLabel('Original ICRA rating PDF', { exact: true })
    .setInputFiles(fileURLToPath(corporateRatingOriginal));
  await region
    .getByLabel('Rating source permission', { exact: true })
    .fill('ICRA142975 p11 free use with ICRA acknowledgement.');
  await region
    .getByRole('checkbox', {
      name: 'I confirm the original and ICRA attribution requirements.',
      exact: true,
    })
    .check();
  await region
    .getByRole('button', { name: 'Retain rating original', exact: true })
    .click();
  await expect(region).toContainText('Editorial status: draft');
  await expect(
    region.getByRole('button', {
      name: 'Inspect retained rating PDF',
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    region.getByRole('button', {
      name: 'Publish reviewed rating',
      exact: true,
    }),
  ).toBeDisabled();
});
test('E2E-WEB-1962 rejected replacement and cancelled file selection cannot submit previous rating original @SRC-018 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const { sourceOpsBrowser } = await import('../../helpers/source-ops-browser');
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Corporate ratings');
  const region = page.getByRole('region', {
      name: 'Corporate rating Operations',
    }),
    file = region.getByLabel('Original ICRA rating PDF', { exact: true }),
    submit = region.getByRole('button', {
      name: 'Retain rating original',
      exact: true,
    });
  await file.setInputFiles(fileURLToPath(corporateRatingOriginal));
  await expect(file).toBeEnabled();
  await region
    .getByLabel('Rating source permission', { exact: true })
    .fill('ICRA142975 p11 use with acknowledgement.');
  const confirm = region.getByRole('checkbox', {
    name: 'I confirm the original and ICRA attribution requirements.',
    exact: true,
  });
  await confirm.check();
  await expect(submit).toBeEnabled();
  await file.setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(2000001),
  });
  await expect(region.getByRole('alert')).toContainText('exceeds2MB');
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await expect(submit).toBeDisabled();
  await file.setInputFiles(fileURLToPath(corporateRatingOriginal));
  await expect(file).toBeEnabled();
  await confirm.check();
  await expect(submit).toBeEnabled();
  await file.setInputFiles([]);
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await expect(submit).toBeDisabled();
});

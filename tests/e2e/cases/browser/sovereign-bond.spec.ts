import { test, expect } from '../../helpers/app-fixture';
import {
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import { sovereignInput, sovereignReview } from '../../helpers/sovereign-bond';
test.use({ namedOperators: true });
test('E2E-WEB-1920 actual reviewed historical bond calculator exposes clean accrued dirty and price choice @SRC-017 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = sovereignInput();
    expect(
      (
        await request.post('/api/v1/ops/sovereign-bonds/import', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/sovereign-bonds/' + input.requestId + '/review',
          { headers, data: sovereignReview() },
        )
      ).status(),
    ).toBe(201);
    await page.route(/\/api\/v1\/sovereign-bonds(?:[/?]|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await page.goto('/#funds-bonds');
    const region = page.getByRole('region', {
      name: 'Historical sovereign bond',
      exact: true,
    });
    await region
      .getByRole('button', {
        name: 'Calculate historical settlement',
        exact: true,
      })
      .click();
    const result = region.getByRole('region', {
      name: 'Historical settlement calculation',
    });
    await expect(result).toContainText('9679.60');
    await region
      .getByLabel('Historical auction price basis')
      .selectOption('weighted');
    await expect(result).toHaveCount(0);
    await region
      .getByRole('button', {
        name: 'Calculate historical settlement',
        exact: true,
      })
      .click();
    await expect(result).toContainText('9681.60');
    await expect(region).toContainText('not a current offer');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1921 actual Operations retains four original envelopes and requires separate source review @SRC-017 @TEST-SIMULATION', async ({
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
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Sovereign bonds');
  const region = page.getByRole('region', {
    name: 'Sovereign bond Operations',
  });
  for (const o of sovereignInput().originals) {
    await region
      .getByLabel('Upload ' + o.kind + ' original', { exact: true })
      .setInputFiles({
        name:
          o.kind +
          (o.kind === 'terms' || o.kind === 'identity' ? '.pdf' : '.html'),
        mimeType:
          o.kind === 'terms' || o.kind === 'identity'
            ? 'application/pdf'
            : 'text/html',
        buffer: Buffer.from(o.body, 'base64'),
      });
    await expect(
      region.getByLabel('Upload ' + o.kind + ' original', { exact: true }),
    ).toBeEnabled();
  }
  await region
    .getByLabel('Sovereign source permission', { exact: true })
    .fill('TEST-SIMULATION synthetic source retention.');
  await region
    .getByRole('checkbox', {
      name: 'I confirm all linked originals and applicable retention/display permission.',
      exact: true,
    })
    .check();
  await region
    .getByRole('button', { name: 'Retain sovereign source pack', exact: true })
    .click();
  await expect(
    region.getByRole('button', { name: 'Inspect retained terms', exact: true }),
  ).toBeVisible();
  await expect(
    region.getByRole('button', {
      name: 'Publish sovereign source pack',
      exact: true,
    }),
  ).toBeDisabled();
  await expect(region).toContainText(
    'Envelope checks do not parse or verify document meaning',
  );
});
test('E2E-WEB-1922 rejected sovereign original replacement removes old file and invalidates capture consent @SRC-017 @TEST-SIMULATION', async ({
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
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Sovereign bonds');
  const region = page.getByRole('region', {
    name: 'Sovereign bond Operations',
  });
  for (const o of sovereignInput().originals) {
    const file = region.getByLabel('Upload ' + o.kind + ' original', {
      exact: true,
    });
    await file.setInputFiles({
      name: o.kind + '.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(o.body, 'base64'),
    });
    await expect(file).toBeEnabled();
  }
  await region
    .getByLabel('Sovereign source permission', { exact: true })
    .fill('TEST-SIMULATION source retention consent.');
  const confirm = region.getByRole('checkbox', {
      name: 'I confirm all linked originals and applicable retention/display permission.',
      exact: true,
    }),
    submit = region.getByRole('button', {
      name: 'Retain sovereign source pack',
      exact: true,
    });
  await confirm.check();
  await expect(submit).toBeEnabled();
  await region
    .getByLabel('Upload terms original', { exact: true })
    .setInputFiles({
      name: 'oversized.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(2000001),
    });
  await expect(region.getByRole('alert')).toContainText('exceeds2MB');
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await expect(submit).toBeDisabled();
});

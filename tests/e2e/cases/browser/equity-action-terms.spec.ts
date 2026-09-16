import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  test,
  expect,
  actionTermsActors,
  actionTermsPdf,
} from '../../helpers/equity-action-terms';
test.use({ namedOperators: true });
test('E2E-WEB-1930 actual rights terms form independent review reader and withdrawal @SRC-003 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer, data } = await actionTermsActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Rights and mergers',
    );
    let ops = page.getByRole('region', {
      name: 'Corporate action terms operations',
    });
    const labels: Record<string, string> = {
      oldIsin: 'Original issuer ISIN',
      oldUnits: 'Existing shares in ratio',
      newUnits: 'New shares in ratio',
      subscriptionPrice: 'Subscription price INR',
      exOn: 'Ex-date',
      recordOn: 'Record date',
      priceOn: 'Reference close date',
      opensOn: 'Rights opening date',
      closesOn: 'Rights closing date',
      renunciationEndsOn: 'On-market renunciation end',
      fractionTreatment: 'Fractional share treatment',
    };
    for (const [key, value] of Object.entries(data.terms)) {
      if (
        ['kind', 'newIsin', 'effectiveOn', 'fixedCashPerOldShare'].includes(
          key,
        ) ||
        value === null
      )
        continue;
      await ops.getByLabel(labels[key]!, { exact: true }).fill(value);
    }
    for (const key of [
      'url',
      'publishedOn',
      'section',
      'transcription',
    ] as const)
      await ops
        .getByLabel('Original ' + key, { exact: true })
        .fill(data.original[key]);
    await ops
      .getByLabel('Original source file', { exact: true })
      .setInputFiles({
        name: 'synthetic-rights.pdf',
        mimeType: 'application/pdf',
        buffer: actionTermsPdf,
      });
    await ops
      .getByLabel('Source permission evidence')
      .fill(data.rightsEvidence);
    await ops
      .getByRole('checkbox', {
        name: 'I checked complete terms and storage, display and offline rights.',
      })
      .check();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ops/equity-action-terms/prepare') &&
        r.request().method() === 'POST',
    );
    await ops
      .getByRole('button', { name: 'Prepare action terms', exact: true })
      .click();
    expect((await saved).status()).toBe(201);
    await expect(ops).toContainText('State: draft');
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Rights and mergers',
    );
    ops = page.getByRole('region', {
      name: 'Corporate action terms operations',
    });
    await ops
      .getByLabel('Independent review reason')
      .fill(
        'Independent original rights ratio, payment and source terms reviewed.',
      );
    await ops
      .getByRole('checkbox', {
        name: 'I independently verified original terms and exact source identities.',
      })
      .check();
    await ops
      .getByRole('button', { name: 'Publish action terms', exact: true })
      .click();
    await expect(ops).toContainText('State: publish');
    await page.goto('/?equity=' + data.terms.oldIsin + '#equities');
    const reader = page.getByRole('region', {
      name: 'Reviewed rights and merger terms',
    });
    await expect(reader).toContainText('₹192.016806722689');
    await expect(reader).toContainText('not an exchange quote');
    const details = reader.getByText('Original terms and arithmetic', {
      exact: true,
    });
    await details.focus();
    await details.press('Enter');
    await expect(reader).toContainText('22850/119');
    const issuer = reader.getByRole('link', {
      name: 'Original issuer',
      exact: true,
    });
    await expect(issuer).toHaveAttribute(
      'href',
      '?equity=' + data.terms.oldIsin + '#equities',
    );
    await issuer.press('Enter');
    await expect(page).toHaveURL(
      new RegExp('equity=' + data.terms.oldIsin + '#equities'),
    );
    await expect(
      page.getByRole('region', { name: 'Reviewed rights and merger terms' }),
    ).toContainText('₹192.016806722689');
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Rights and mergers',
    );
    ops = page.getByRole('region', {
      name: 'Corporate action terms operations',
    });
    await ops
      .getByLabel('Independent review reason')
      .fill('Withdraw original terms publication after review.');
    await ops
      .getByRole('button', { name: 'Withdraw action terms', exact: true })
      .click();
    await expect(ops).toContainText('State: withdraw');
    await page.goto('/?equity=' + data.terms.oldIsin + '#equities');
    await expect(
      page.getByRole('region', { name: 'Reviewed rights and merger terms' }),
    ).toContainText('No currently admitted');
  } finally {
    await reviewer.dispose();
  }
});

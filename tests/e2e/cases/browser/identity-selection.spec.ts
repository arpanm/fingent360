import {
  test,
  expect,
  eventHeaders,
  seedSelectionIdentity,
  saveSelection,
  applySelection,
} from '../../helpers/identity-selection';
import { eventFixture } from '../../helpers/event-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-870 candidate review Back saved plan and public provider-vs-judgement display @IDENTITY-ADJUDICATION-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}, testInfo) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox);
  await context.addCookies(
    (await request.storageState()).cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Identity selections', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Load stored candidate identities',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Stored ISIN', { exact: true })
    .selectOption(provider.isin);
  await expect(
    page.getByRole('radio', { name: /Synthetic candidate 1/ }),
  ).toBeEnabled();
  const candidate = page.getByRole('radio', {
    name: /Synthetic candidate 1/,
  });
  await candidate.focus();
  await expect(candidate).toBeFocused();
  await page.keyboard.press('Space');
  await expect(candidate).toBeChecked();
  await page
    .getByLabel('Editorial selection rationale', { exact: true })
    .fill(
      'Synthetic independent judgement based only on retained candidate membership.',
    );
  const review = page.getByRole('button', {
    name: 'Review selection plan',
    exact: true,
  });
  const save = page.getByRole('button', {
    name: 'Save selection plan',
    exact: true,
  });
  const back = page.getByRole('button', {
    name: 'Back to candidate review',
    exact: true,
  });
  await review.focus();
  await expect(review).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(save).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(review).toBeFocused();
  await expect(
    page.getByLabel('Editorial selection rationale', { exact: true }),
  ).toHaveValue(
    'Synthetic independent judgement based only on retained candidate membership.',
  );
  await page.keyboard.press('Enter');
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');
  const saved = page.getByRole('region', {
    name: 'Saved identity selection plan',
    exact: true,
  });
  await expect(saved).toContainText('Synthetic candidate 1');
  const apply = saved.getByRole('button', {
    name: 'Apply selection in bootstrap mode',
    exact: true,
  });
  await expect(apply).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(/Saved historical selection receipt: approved/),
  ).toBeVisible();
  await page.goto('/#securities/' + provider.isin);
  await expect(
    page.getByText(
      'Several mappings were returned. No identity has been selected automatically.',
      { exact: true },
    ),
  ).toBeVisible();
  const detail = page.getByRole('region', {
    name: 'Reviewed candidate selection',
    exact: true,
  });
  await expect(detail).toContainText('Selection status: current');
  await expect(detail).toContainText('Synthetic candidate 1');
  const history = detail.getByRole('button', {
    name: 'Read selection history',
    exact: true,
  });
  await history.focus();
  await expect(history).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(detail).toContainText('Revision 1: approved');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('synthetic-identity-selection-keyboard.png'),
    fullPage: true,
  });
});
test('E2E-WEB-871 actual revoked session clears candidate review without leaking stored plans @IDENTITY-ADJUDICATION-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  await eventFixture(request, feedbackSandbox);
  await seedSelectionIdentity(feedbackSandbox);
  await context.addCookies(
    (await request.storageState()).cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Identity selections', exact: true })
    .click();
  expect(
    (
      await request.delete('/api/v1/ops/session', { headers: eventHeaders })
    ).ok(),
  ).toBe(true);
  const denial = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/ops/identity-selections' &&
      response.status() === 401,
  );
  await page
    .getByRole('button', { name: 'Load selection plans', exact: true })
    .click();
  await denial;
  await expect(page.getByLabel('Operator key', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: 'Identity selection review',
      exact: true,
    }),
  ).toHaveCount(0);
});
test('E2E-WEB-872 actual empty selection history has bounded loading and recovers to an explicit empty result @IDENTITY-ADJUDICATION-001', async ({
  page,
  feedbackSandbox,
}) => {
  const provider = await seedSelectionIdentity(feedbackSandbox);
  let release!: () => void, finish!: () => void;
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    drained = new Promise<void>((resolve) => {
      finish = resolve;
    });
  let actualStatus: number | null = null,
    started = false;
  const pattern =
    '**/api/v1/securities/' + provider.isin + '/selection/history';
  await page.route(pattern, async (route) => {
    started = true;
    try {
      const response = await route.fetch({
        url:
          feedbackSandbox.apiOrigin + new URL(route.request().url()).pathname,
      });
      actualStatus = response.status();
      await held;
      await route.fulfill({ response });
    } finally {
      finish();
    }
  });
  try {
    await page.goto('/#securities/' + provider.isin);
    const panel = page.getByRole('region', {
      name: 'Reviewed candidate selection',
      exact: true,
    });
    await expect(panel).toContainText('Selection status: none');
    await panel
      .getByRole('button', { name: 'Read selection history', exact: true })
      .click();
    await expect(panel.getByRole('status')).toHaveText(
      'Loading selection history…',
    );
    await expect(
      panel.getByRole('button', {
        name: 'Read selection history',
        exact: true,
      }),
    ).toBeDisabled();
    release();
    await drained;
    expect(actualStatus).toBe(200);
    await expect(panel.getByRole('status')).toHaveText(
      'No reviewed selection history yet.',
    );
    await expect(
      panel.getByRole('button', {
        name: 'Read selection history',
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    release();
    if (started) await drained;
  }
});

test('E2E-WEB-873 competing selection requires explicit draft discard and current reload before a fresh plan @IDENTITY-ADJUDICATION-001', async ({
  page,
  context,
  request,
  feedbackSandbox,
  baseURL,
}) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox);
  await context.addCookies(
    (await request.storageState()).cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseURL!,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  );
  await page.goto('/#ops');
  await page
    .getByRole('button', { name: 'Identity selections', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Load stored candidate identities',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Stored ISIN', { exact: true })
    .selectOption(provider.isin);
  await expect(
    page.getByRole('radio', { name: /Synthetic candidate 1/ }),
  ).toBeEnabled();
  await page.getByRole('radio', { name: /Synthetic candidate 1/ }).check();
  await page
    .getByLabel('Editorial selection rationale', { exact: true })
    .fill('Synthetic draft based on the old selection head.');
  await applySelection(request, await saveSelection(request, provider));
  await page
    .getByRole('button', { name: 'Review selection plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save selection plan', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Discard the edited draft',
  );
  await expect(
    page.getByRole('button', { name: 'Review selection plan', exact: true }),
  ).toBeDisabled();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Discard selection draft', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reload current selection', exact: true })
    .click();
  await expect(
    page.getByRole('radio', { name: /Synthetic candidate 1/ }),
  ).toBeEnabled();
  await page.getByRole('radio', { name: /Synthetic candidate 1/ }).check();
  await page
    .getByLabel('Editorial selection rationale', { exact: true })
    .fill('Synthetic fresh plan after explicitly reviewing the new head.');
  await page
    .getByRole('button', { name: 'Review selection plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save selection plan', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Saved identity selection plan',
      exact: true,
    }),
  ).toContainText('selection base 1');
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const database = await connectionDatabase(feedbackSandbox);
  try {
    const changed = { ...provider, version: 2, sourceHash: 'b'.repeat(64) };
    await database.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,2,$2,$3)',
      [provider.isin, changed.sourceHash, changed],
    );
    await database.query(
      'UPDATE security_identities SET version=2 WHERE isin=$1',
      [provider.isin],
    );
  } finally {
    await database.end();
  }
  await expect(
    page.getByRole('radio', { name: /Synthetic candidate 1/ }),
  ).toBeEnabled();
  await page.getByRole('radio', { name: /Synthetic candidate 1/ }).check();
  await page
    .getByLabel('Editorial selection rationale', { exact: true })
    .fill('Synthetic draft which must detect the changed provider.');
  await page
    .getByRole('button', { name: 'Review selection plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save selection plan', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Discard the edited draft',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Discard selection draft', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reload current selection', exact: true })
    .click();
  await expect(
    page.getByText('Provider revision 2: ambiguous. 2 candidates.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('radio', { name: /Synthetic candidate 1/ }),
  ).toBeEnabled();
  await page.getByRole('radio', { name: /Synthetic candidate 1/ }).check();
  await page
    .getByLabel('Editorial selection rationale', { exact: true })
    .fill(
      'Synthetic plan explicitly using the newly reloaded provider edition.',
    );
  await page
    .getByRole('button', { name: 'Review selection plan', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save selection plan', exact: true })
    .click();
  await expect(
    page.getByRole('region', {
      name: 'Saved identity selection plan',
      exact: true,
    }),
  ).toContainText('Provider revision 2, ambiguous; selection base 1.');
});

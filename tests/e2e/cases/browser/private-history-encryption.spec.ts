import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable } from '../../helpers/auth-wait';
import { consentWrite } from '../../helpers/consent-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-1254 owner opens encrypted private history and deletes it through privacy controls @DEV-017 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  const db = await connectionDatabase(feedbackSandbox);
  const url = new URL(
    '../../../../apps/api/dist/private-ai-history.js',
    import.meta.url,
  ).href;
  const { startPrivateAiHistory, finishPrivateAiHistory } = await import(url);
  try {
    const id = await startPrivateAiHistory(
      db,
      owner.id,
      'openai',
      'synthetic',
      'Synthetic instructions',
      'Synthetic private question',
      feedbackSandbox.privateDataKeys,
    );
    await finishPrivateAiHistory(
      db,
      owner.id,
      id,
      {
        raw: 'Synthetic provider output',
        text: 'Synthetic encrypted answer',
        status: 'succeeded',
      },
      feedbackSandbox.privateDataKeys,
    );
    expect(
      (await db.query('SELECT input FROM private_ai_history WHERE id=$1', [id]))
        .rows[0].input,
    ).toBe('');
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto('/#privacy');
    const history = page.getByRole('region', {
      name: 'My AI request history',
      exact: true,
    });
    await history
      .getByRole('button', { name: 'Load my AI history', exact: true })
      .click();
    await expect(history).toContainText('1 retained requests');
    await history.locator('summary').click();
    await expect(history.locator('pre')).toBeVisible();
    await expect(history).toContainText('Synthetic private question');
    await expect(history).toContainText('Synthetic encrypted answer');
    await history
      .getByRole('button', { name: 'Delete my AI history', exact: true })
      .click();
    await expect(history).toContainText('0 retained requests');
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await db.end();
  }
});

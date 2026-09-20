import { createRequire } from 'node:module';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { connectionDatabase } from './research-connection-fixture';
import { tabToObservationControl } from './observation-inbox-accessibility';
export async function privacyType(page: Page, control: Locator, value: string) {
  await tabToObservationControl(page, control);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
}
export async function privacyActivate(
  page: Page,
  control: Locator,
  key: 'Enter' | 'Space' = 'Enter',
) {
  await tabToObservationControl(page, control);
  await page.keyboard.press(key);
}
export async function authenticator(secret: string, offset = 0) {
  createRequire(new URL('../../../apps/api/package.json', import.meta.url))(
    'reflect-metadata',
  );
  const { authenticatorCode } = await import(
    new URL('../../../apps/api/dist/account-mfa-crypto.js', import.meta.url)
      .href
  );
  return authenticatorCode(
    secret,
    Math.floor(Date.now() / 30000) + offset,
  ) as string;
}
// Actual encrypted-history admission/finish helpers, not seeded ciphertext or
// invented API success. Synthetic input only; this is not provider activation.
export async function retainSyntheticPrivacyHistory(
  sandbox: FeedbackSandbox,
  owner: string,
) {
  createRequire(new URL('../../../apps/api/package.json', import.meta.url))(
    'reflect-metadata',
  );
  const pool = await connectionDatabase(sandbox);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { startPrivateAiHistory, finishPrivateAiHistory } = await import(
      new URL('../../../apps/api/dist/private-ai-history.js', import.meta.url)
        .href
    );
    const id = await startPrivateAiHistory(
      client,
      owner,
      'synthetic',
      'synthetic-privacy-ui',
      'TEST-SIMULATION history controls',
      'Synthetic private history keyboard question',
      sandbox.privateDataKeys,
    );
    if (!id) throw Error('Actual private-history consent admission required.');
    await finishPrivateAiHistory(
      client,
      owner,
      id,
      {
        raw: 'Synthetic private history raw response',
        text: 'Synthetic private history answer',
        status: 'succeeded',
        outcome:
          'TEST-SIMULATION retained controls fixture, not provider execution.',
      },
      sandbox.privateDataKeys,
    );
    const saved = (
      await client.query(
        'SELECT input,encrypted_payload FROM private_ai_history WHERE id=$1',
        [id],
      )
    ).rows[0];
    expect(saved.input).toBe('');
    expect(saved.encrypted_payload).not.toBeNull();
    await client.query('COMMIT');
    return id as string;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

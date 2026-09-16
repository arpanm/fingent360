import { test, expect } from '@playwright/test';
import type { IOSFeedbackBridge } from '../../../../apps/web/src/native-bridge';
// This tests shared adapter behavior; physical WK/Keychain/microphone acceptance is separate.
test('E2E-WEB-1610 simulated iOS voice permission denial recovers to text without browser microphone fallback @DEV-029 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.FingentIOS = {
      startFeedbackAudio: async () => {
        throw Error(
          'Microphone permission was not granted. Enable it in iOS Settings or type feedback.',
        );
      },
      stopFeedbackAudio: async () => {
        throw Error('No recording');
      },
      cancelFeedbackAudio: async () => ({ cancelled: true }),
      feedbackRead: async () => ({
        revision: 0,
        records: [],
        config: { enabled: false, apiOrigin: '' },
      }),
      feedbackWrite: async () => ({ revision: 1 }),
      sendFeedback: async () => {
        throw Error('Synthetic offline');
      },
    } satisfies IOSFeedbackBridge;
  });
  await page.goto('/#today');
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  await page.getByRole('button', { name: /Record voice feedback/ }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Microphone permission was not granted',
  );
  await expect(
    page.getByRole('button', { name: /Record voice feedback/ }),
  ).toBeVisible();
  await page
    .getByLabel('Your feedback', { exact: true })
    .fill('Text remains available');
  await expect(page.getByLabel('Your feedback', { exact: true })).toHaveValue(
    'Text remains available',
  );
});
test('E2E-WEB-1611 simulated iOS stop and discard use native recorder lifecycle @DEV-029 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.FingentIOS = {
      startFeedbackAudio: async () => ({ recording: true }),
      stopFeedbackAudio: async () => ({
        mime: 'audio/mp4',
        base64: 'AAAA',
        durationMs: 1000,
      }),
      cancelFeedbackAudio: async () => ({ cancelled: true }),
      feedbackRead: async () => ({
        revision: 0,
        records: [],
        config: { enabled: false, apiOrigin: '' },
      }),
      feedbackWrite: async () => ({ revision: 1 }),
      sendFeedback: async () => {
        throw Error('Synthetic offline');
      },
    } satisfies IOSFeedbackBridge;
  });
  await page.goto('/#today');
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  await page.getByRole('button', { name: /Record voice feedback/ }).click();
  await page
    .getByRole('button', { name: 'Stop recording', exact: true })
    .click();
  await expect(page.getByLabel('Recorded feedback')).toHaveAttribute(
    'src',
    'data:audio/mp4;base64,AAAA',
  );
  await page
    .getByRole('button', { name: 'Remove voice note', exact: true })
    .click();
  await expect(page.getByLabel('Recorded feedback')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Record voice feedback/ }),
  ).toBeVisible();
});
test('E2E-WEB-1612 simulated iOS capture failure preserves feedback-only recovery @DEV-029 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.FingentIOS = {
      captureFeedback: async () => {
        throw Error('Native screenshot unavailable. Use feedback only.');
      },
      startFeedbackAudio: async () => ({ recording: true }),
      stopFeedbackAudio: async () => ({
        mime: 'audio/mp4',
        base64: 'AAAA',
        durationMs: 1000,
      }),
      cancelFeedbackAudio: async () => ({ cancelled: true }),
      feedbackRead: async () => ({
        revision: 0,
        records: [],
        config: { enabled: false, apiOrigin: '' },
      }),
      feedbackWrite: async () => ({ revision: 1 }),
      sendFeedback: async () => {
        throw Error('Synthetic offline');
      },
    } satisfies IOSFeedbackBridge;
  });
  await page.goto('/#today');
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Screenshot + feedback', exact: true })
    .click();
  await expect(
    page.getByText('Native screenshot unavailable. Use feedback only.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Your feedback', { exact: true })).toBeVisible();
});

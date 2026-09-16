import type { FeedbackSandbox } from './feedback-fixture';
import { whatsappHeaders } from './whatsapp-channel';
export const syntheticWhatsappSchedule = {
  frequency: 'daily',
  time: '09:00',
  timezone: 'Asia/Kolkata',
  weekday: 1,
  sourceIds: ['glossary'],
  maxItems: 1,
  maxAgeHours: 24,
};
export async function whatsappScheduleWorker(sandbox: FeedbackSandbox) {
  const { readConfig } = await import(
      new URL('../../../apps/api/dist/config.js', import.meta.url).href
    ),
    { AccountStore } = await import(
      new URL('../../../apps/api/dist/accounts.js', import.meta.url).href
    ),
    { prepareWhatsappOccurrence } = await import(
      new URL('../../../apps/api/dist/whatsapp-schedule.js', import.meta.url)
        .href
    );
  const config = readConfig({
    DATABASE_URL: sandbox.databaseUrl,
    MONGODB_URI: 'mongodb://127.0.0.1:57017/unused_whatsapp',
    WEB_ORIGIN: whatsappHeaders.Origin,
    ...sandbox.privateDataKeys,
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_AUTOMATIC_DISPATCH: 'false',
    WHATSAPP_ACCESS_TOKEN: 'synthetic-access-token-never-send',
    WHATSAPP_APP_SECRET: 'synthetic-whatsapp-app-secret',
    WHATSAPP_VERIFY_TOKEN: 'synthetic-whatsapp-verify-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_BUSINESS_NUMBER: '15555550100',
    WHATSAPP_TEMPLATE_NAME: 'fingent_public_summary',
    WHATSAPP_PUBLIC_ORIGIN: 'https://reading.example.com',
    WHATSAPP_APPROVAL_REFERENCE:
      'TEST-SIMULATION only; no provider activation or actual permission.',
    WHATSAPP_ALLOWED_SOURCE_IDS: 'glossary',
  });
  const account = new AccountStore(config);
  return {
    config,
    run: () => prepareWhatsappOccurrence(account, config),
    close: () => account.onApplicationShutdown(),
  };
}

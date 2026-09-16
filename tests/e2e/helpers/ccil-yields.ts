import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
import type { FeedbackSandbox } from './feedback-fixture';
export function syntheticCcilHtml(date = '2026-09-11') {
  const tenors = [
    '91D',
    '182D',
    '364D',
    '1Y-2Y',
    '4Y-5Y',
    '9Y-10Y',
    '13Y-15Y',
    '28Y-30Y',
    '5Y',
    '10Y',
    '15Y',
  ];
  return `<html><body><table id="dtTable"><thead><tr>${['Date', 'Tenor Bucket', 'Security', 'YTM (%)'].map((h) => `<th align="center">${h}</th>`).join('')}</tr></thead><tbody>${tenors.map((tenor, i) => `<tr><td>${date} 00:00:00.0</td><td>${tenor}</td><td>${i < 3 ? tenor.slice(0, -1) + ' DTB (01/01/2030)' : i > 7 ? '7.00% SYNTHETIC SGS 2035' : '6.00% GS 2035'}</td><td>${i < 8 ? '6.1234' : '7.00'}</td></tr>`).join('')}</tbody></table><p>Tbill and SDL YTMs are primary market cut-offs</p></body></html>`;
}
export async function publishedCcilFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox);
  try {
    const id = randomUUID();
    const capture = await request.post('/api/v1/ops/bond-yields/import', {
      headers,
      data: { requestId: id, body: syntheticCcilHtml() },
    });
    expect(capture.status()).toBe(201);
    const review = await auth.reviewer.post(
      `/api/v1/ops/bond-yields/${id}/review`,
      {
        headers,
        data: {
          requestId: randomUUID(),
          decision: 'publish',
          reason: 'Independent synthetic yield source review.',
        },
      },
    );
    expect(review.status()).toBe(201);
    return { ...auth, id, edition: await review.json() };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}

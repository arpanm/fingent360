import { randomUUID } from 'node:crypto';
import {
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
export const syntheticRegulatoryHtml =
  '<html><body><h1>Synthetic source registry acceptance</h1><p>Not actual law or tax policy. Unknown effective date.</p></body></html>';
export function regulatoryCapture(supersedes: string | null = null) {
  return {
    requestId: randomUUID(),
    metadata: {
      documentKey: 'synthetic-editorial-source',
      authority: 'income-tax',
      title: 'Synthetic tax source annotation',
      kind: 'faq',
      sourceUrl:
        'https://www.incometax.gov.in/iec/foportal/using-the-portal/webSitePolicies',
      jurisdiction: 'India',
      scope: 'Synthetic India source acceptance only.',
      summary:
        'Synthetic editorial annotation, not an actual tax rule or source quotation.',
      publication: { precision: 'year', value: '2026' },
      effective: { precision: 'unknown', value: null },
      dateEvidence:
        'Synthetic source fixture deliberately has no legal effective date.',
      supersedes,
      reviewBy: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    },
    rightsReference: 'Synthetic local test permission; not a real grant.',
    mime: 'text/html',
    bodyBase64: Buffer.from(syntheticRegulatoryHtml).toString('base64'),
    retrievedAt: new Date().toISOString(),
  };
}
export async function regulatoryFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox);
  try {
    const input = regulatoryCapture();
    const capture = await request.post(
      '/api/v1/ops/regulatory-sources/import',
      { headers, data: input },
    );
    expect(capture.status()).toBe(201);
    return {
      ...auth,
      input,
      id: input.requestId,
      edition: await capture.json(),
    };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}
export const regulatoryReview = () => ({
  requestId: randomUUID(),
  decision: 'publish',
  reason: 'Independent synthetic original and precision annotation review.',
  originalReviewed: true,
});

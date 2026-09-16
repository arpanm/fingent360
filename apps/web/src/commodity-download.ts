import { CommodityEvidenceSchema } from '@fingent360/contracts';
import { json } from './net';
import { saveDownload } from './runtime';
export async function downloadCommodityOriginal(
  id: string,
  expectedHash: string,
  operator = false,
  request: typeof json = json,
) {
  const value = CommodityEvidenceSchema.parse(
    await request(
      (operator ? '/ops' : '') + '/commodity-benchmarks/' + id + '/evidence',
    ),
  );
  if (value.id !== id || value.bodyHash !== expectedHash)
    throw Error('Retained original identity changed. Refresh this edition.');
  const bytes = Uint8Array.from(atob(value.body), (c) => c.charCodeAt(0));
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  if (digest !== expectedHash)
    throw Error('Retained original failed its checksum.');
  return saveDownload(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'world-bank-monthly-' + id + '.xlsx',
  );
}

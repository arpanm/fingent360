import { createHash } from 'node:crypto';
import { ECB_FX_URL } from '@fingent360/contracts';

export interface EcbFxRaw {
  url: typeof ECB_FX_URL;
  body: string;
  retrievedAt: string;
  hash: string;
}
export const ecbFxReceiptHash = (
  raw: Pick<EcbFxRaw, 'url' | 'body' | 'retrievedAt'>,
) =>
  createHash('sha256')
    .update(`${raw.url}\n${raw.retrievedAt}\n${raw.body}`)
    .digest('hex');

/** One fixed first-party request. No cookies, redirects, credentials or implicit retry. */
export async function fetchEcbFx(): Promise<EcbFxRaw> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(ECB_FX_URL, {
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'application/xml' },
    });
    if (
      response.status !== 200 ||
      response.url !== ECB_FX_URL ||
      !response.body
    )
      throw Error('ECB reference FX response is unavailable.');
    const type = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!type.includes('xml') || type.includes('html'))
      throw Error('ECB did not return XML.');
    const declared = response.headers.get('content-length');
    if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > 1000000))
      throw Error('ECB response exceeds its bound.');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    let body = '',
      size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1000000) throw Error('ECB response exceeds its bound.');
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
    if (
      !body ||
      (declared &&
        !response.headers.get('content-encoding') &&
        Number(declared) !== size)
    )
      throw Error('ECB response is empty or incomplete.');
    const raw: Pick<EcbFxRaw, 'url' | 'body' | 'retrievedAt'> = {
      url: ECB_FX_URL,
      body,
      retrievedAt: new Date().toISOString(),
    };
    return { ...raw, hash: ecbFxReceiptHash(raw) };
  } finally {
    controller.abort();
    clearTimeout(timeout);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

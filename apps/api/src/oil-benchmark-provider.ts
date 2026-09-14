import { createHash } from 'node:crypto';
import { OIL_BENCHMARK_URL } from '@fingent360/contracts';

export interface OilBenchmarkRaw {
  url: typeof OIL_BENCHMARK_URL;
  body: string;
  retrievedAt: string;
  hash: string;
}
export function oilReceiptHash(
  raw: Pick<OilBenchmarkRaw, 'url' | 'body' | 'retrievedAt'>,
) {
  const bytes = Buffer.from(raw.body, 'base64');
  if (
    !bytes.length ||
    bytes.length > 3000000 ||
    bytes.toString('base64') !== raw.body
  )
    throw Error('Invalid retained workbook encoding.');
  return createHash('sha256')
    .update(`${raw.url}\n${raw.retrievedAt}\n`)
    .update(bytes)
    .digest('hex');
}

/** Fixed official distribution; connections inside the workbook are never executed. */
export async function fetchOilBenchmarks(): Promise<OilBenchmarkRaw> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(OIL_BENCHMARK_URL, {
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    if (
      response.status !== 200 ||
      response.url !== OIL_BENCHMARK_URL ||
      !response.body ||
      !(response.headers.get('content-type') ?? '')
        .toLowerCase()
        .startsWith(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
    )
      throw Error('The official monthly workbook is unavailable.');
    const declared = response.headers.get('content-length');
    if (declared && (!/^[0-9]+$/.test(declared) || Number(declared) > 3000000))
      throw Error('Workbook exceeds its byte bound.');
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 3000000) throw Error('Workbook exceeds its byte bound.');
      chunks.push(part.value);
    }
    if (
      !size ||
      (declared &&
        !response.headers.get('content-encoding') &&
        Number(declared) !== size)
    )
      throw Error('Workbook is empty or incomplete.');
    const raw: Pick<OilBenchmarkRaw, 'url' | 'body' | 'retrievedAt'> = {
      url: OIL_BENCHMARK_URL,
      body: Buffer.concat(chunks).toString('base64'),
      retrievedAt: new Date().toISOString(),
    };
    return { ...raw, hash: oilReceiptHash(raw) };
  } finally {
    controller.abort();
    clearTimeout(timeout);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

import {
  WorkbookWorkerReplySchema,
  type parseHoldingsWorkbook,
} from '@fingent360/contracts';
export function parseWorkbook(
  bytes: Uint8Array,
): Promise<ReturnType<typeof parseHoldingsWorkbook>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./workbook-worker.ts', import.meta.url),
      { type: 'module' },
    );
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error('Workbook parsing timed out. Use the standard template.'));
    }, 2000);
    const stop = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      stop();
      const reply = WorkbookWorkerReplySchema.safeParse(event.data);
      if (!reply.success) {
        reject(Error('Workbook parser returned an invalid result.'));
        return;
      }
      if ('error' in reply.data) reject(Error(reply.data.error));
      else resolve(reply.data.result);
    };
    worker.onerror = () => {
      stop();
      reject(Error('Workbook parser could not start. Retry or use CSV.'));
    };
    worker.onmessageerror = () => {
      stop();
      reject(Error('Workbook parser returned an unreadable result.'));
    };
    try {
      worker.postMessage(bytes);
    } catch {
      stop();
      reject(Error('Workbook could not be sent to its parser.'));
    }
  });
}

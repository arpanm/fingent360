import { Worker } from 'node:worker_threads';
import {
  WorkbookWorkerReplySchema,
  type parseHoldingsWorkbook,
} from '@fingent360/contracts';
type ParsedWorkbook = ReturnType<typeof parseHoldingsWorkbook>;
/** Factory isolates the concurrency budget and permits actual worker lifecycle regression fixtures. */
export function createWorkbookParser(
  spawn: (bytes: Uint8Array) => Worker = (bytes) =>
    new Worker(new URL('./workbook-worker.js', import.meta.url), {
      workerData: bytes.buffer,
      resourceLimits: {
        maxOldGenerationSizeMb: 32,
        maxYoungGenerationSizeMb: 8,
      },
    }),
  timeoutMs = 2000,
) {
  let activeWorkers = 0;
  return async function parse(bytes: Uint8Array): Promise<ParsedWorkbook> {
    if (activeWorkers >= 2)
      throw Error('Workbook parser is busy. Please retry shortly.');
    activeWorkers++;
    try {
      // Synchronous constructor failures also pass through the capacity finally block.
      const worker = spawn(bytes);
      return await new Promise<ParsedWorkbook>((resolve, reject) => {
        let finishing = false;
        const finish = (error: Error | null, result?: ParsedWorkbook) => {
          if (finishing) return;
          finishing = true;
          clearTimeout(timer);
          // Keep the capacity lease until the worker has actually stopped, including on success.
          void worker.terminate().then(
            () => {
              if (error) reject(error);
              else if (result) resolve(result);
              else reject(Error('Workbook parser returned no result.'));
            },
            () => reject(Error('Workbook parser could not be stopped.')),
          );
        };
        const timer = setTimeout(
          () =>
            finish(
              Error('Workbook parsing timed out. Use the standard template.'),
            ),
          timeoutMs,
        );
        worker.once('message', (message: unknown) => {
          const reply = WorkbookWorkerReplySchema.safeParse(message);
          if (!reply.success) {
            finish(Error('Workbook parser returned an invalid result.'));
            return;
          }
          if ('error' in reply.data) finish(Error(reply.data.error));
          else finish(null, reply.data.result);
        });
        worker.once('error', () =>
          finish(Error('Workbook parser could not process this file.')),
        );
        worker.once('exit', () =>
          finish(Error('Workbook parser exited before returning a result.')),
        );
      });
    } finally {
      activeWorkers--;
    }
  };
}
export const parseWorkbook = createWorkbookParser();

import { parentPort, workerData } from 'node:worker_threads';
import { parseHoldingsWorkbook } from '@fingent360/contracts';
try {
  parentPort?.postMessage({
    result: parseHoldingsWorkbook(new Uint8Array(workerData as ArrayBuffer)),
  });
} catch (error) {
  parentPort?.postMessage({
    error: error instanceof Error ? error.message : 'Invalid workbook.',
  });
}

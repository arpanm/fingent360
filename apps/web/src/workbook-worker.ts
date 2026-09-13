import { parseHoldingsWorkbook } from '@fingent360/contracts';
self.onmessage = (event: MessageEvent<Uint8Array>) => {
  try {
    self.postMessage({ result: parseHoldingsWorkbook(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Invalid workbook.',
    });
  }
};

import { test, expect } from '@playwright/test';
import { mappingAccount } from '../../helpers/mapped-import';
import { inspectBrokerGuidance } from '../../helpers/broker-parsers';
test('E2E-OFFLINE-930 broker guidance and mapped transition work without network @BROKER-PARSERS-002', async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      outgoing.push(request.url());
  });
  await mappingAccount(page, true);
  await inspectBrokerGuidance(page);
  expect(outgoing).toEqual([]);
});

import { test } from '../../helpers/app-fixture';
import { mappingAccount } from '../../helpers/mapped-import';
import { inspectBrokerGuidance } from '../../helpers/broker-parsers';
test('E2E-WEB-930 five broker guides connect to exact mapped import without claiming format support @BROKER-PARSERS-002', async ({
  page,
}) => {
  await mappingAccount(page);
  await inspectBrokerGuidance(page);
});

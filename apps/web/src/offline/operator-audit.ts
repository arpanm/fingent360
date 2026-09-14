import { fail, type OfflineHandler } from './types';
export const handleOperatorAudit: OfflineHandler = (request) => {
  if (
    request.path === '/api/v1/ops/audit' ||
    request.path.startsWith('/api/v1/ops/audit/')
  )
    fail(
      503,
      'Audit activity requires a connected server and an operations sign-in. No server audit records are stored on this device.',
    );
  return null;
};

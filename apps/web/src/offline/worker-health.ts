import { fail, type OfflineHandler } from './types';
export const handleWorkerHealth: OfflineHandler = (request) => {
  if (
    request.path === '/api/v1/ops/workers' ||
    request.path.startsWith('/api/v1/ops/workers/')
  )
    fail(
      503,
      'Worker health requires a connected server and an operations sign-in. Device reminders and reports are unchanged.',
    );
  return null;
};

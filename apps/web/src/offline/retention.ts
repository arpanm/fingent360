import { fail, type OfflineHandler } from './types';
export const handleRetention: OfflineHandler = (request) => {
  if (
    request.path === '/api/v1/ops/retention' ||
    request.path.startsWith('/api/v1/ops/retention/')
  )
    fail(
      503,
      'Expired data cleanup requires a connected server and an operations sign-in. Device records are unchanged.',
    );
  return null;
};

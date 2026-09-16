import { fail, type OfflineHandler } from './types';
export const handleFilingWatch: OfflineHandler = (request) => {
  if (
    request.path === '/api/v1/ops/filing-watch' ||
    request.path.startsWith('/api/v1/ops/filing-watch/')
  )
    fail(
      503,
      'Original filing watch configuration, acquisition and review require connected Operations.',
    );
  return null;
};

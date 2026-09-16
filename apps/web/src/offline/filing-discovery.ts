import { fail, type OfflineHandler } from './types';
export const handleFilingDiscovery: OfflineHandler = (request) => {
  if (
    request.path === '/api/v1/ops/filing-discovery' ||
    request.path.startsWith('/api/v1/ops/filing-discovery/')
  )
    fail(
      503,
      'Filing discovery requires connected Operations. Discovered pointers are not offline financial facts.',
    );
  return null;
};

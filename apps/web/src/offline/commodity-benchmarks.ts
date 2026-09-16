import { CommodityPublicSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleCommodityBenchmarks: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path.startsWith('/api/v1/ops/commodity-benchmarks'))
    return fail(
      503,
      'Commodity capture and review require connected Operations.',
    );
  if (!request.path.startsWith('/api/v1/commodity-benchmarks')) return null;
  if (request.method !== 'GET')
    return fail(404, 'Unknown commodity operation.');
  if (request.path !== '/api/v1/commodity-benchmarks')
    return fail(
      503,
      'Original workbook bytes are not installed. Reconnect to download the exact retained evidence.',
    );
  const value = CommodityPublicSchema.safeParse(bundle.commodityBenchmarks);
  if (!value.success)
    return fail(
      503,
      'No readable reviewed commodity edition is installed. Refresh the device snapshot.',
    );
  const edition = request.query.get('edition');
  if (edition && edition !== value.data.receipt.id)
    return fail(404, 'This retained edition is not installed.');
  return { body: { ...value.data, editions: [value.data.receipt.id] } };
};

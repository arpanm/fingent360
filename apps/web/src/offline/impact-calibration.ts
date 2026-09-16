import { z } from 'zod';
import {
  ImpactCalibrationInputSchema,
  ImpactCalibrationReceiptSchema,
  ImpactCalibrationListSchema,
  EquitySnapshotSchema,
  EcbFxPublicSchema,
  calibrateImpact,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type OfflineHandler,
  type LocalState,
} from './types';
import { localHoldings, parseLocal } from './finance';
import { handleEcbFx } from './ecb-fx';
type Receipt = ReturnType<typeof ImpactCalibrationReceiptSchema.parse>;
function rows(state: LocalState, userId: string) {
  return (
    (
      (state.data.localImpactCalibrations ?? {}) as Record<
        string,
        Record<string, Receipt | null>
      >
    )[userId] ?? {}
  );
}
export function exportLocalImpactCalibrations(
  state: LocalState,
  userId: string,
) {
  return ImpactCalibrationListSchema.parse({
    receipts: Object.values(rows(state, userId)).filter(
      (item) => item !== null,
    ),
  });
}
export const handleImpactCalibrations: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  const base = '/api/v1/account/impact-calibrations';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  const user = requireUser(state),
    values = rows(state, user.id);
  if (request.path === base && request.method === 'GET')
    return { body: exportLocalImpactCalibrations(state, user.id) };
  const id = z.uuid().safeParse(request.path.slice(base.length + 1));
  if (!id.success) fail(400, 'Invalid calibration receipt.');
  if (request.method === 'PUT') {
    const input = parseLocal(ImpactCalibrationInputSchema, request.body);
    if (Object.hasOwn(values, id.data)) {
      const old = values[id.data];
      if (!old) fail(410, 'Calibration deleted.');
      if (old.input.isin !== input.isin)
        fail(409, 'Receipt belongs to another holding.');
      return { body: old };
    }
    if (
      !localHoldings(state, user.id).holdings.some(
        (item) => item.isin === input.isin,
      )
    )
      fail(409, 'Choose one of your saved holdings.');
    if (Object.values(values).filter(Boolean).length >= 50)
      fail(409, 'Remove a calibration before exceeding 50 receipts.');
    const equity =
      EquitySnapshotSchema.parse(
        bundle.equityCoverage ?? {
          capturedAt: bundle.generatedAt,
          companies: [],
        },
      ).companies.find((item) => item.isin === input.isin) ?? null;
    const factor = EcbFxPublicSchema.parse(
        (
          await handleEcbFx(
            {
              ...request,
              path: '/api/v1/reference-fx',
              method: 'GET',
              query: new URLSearchParams(),
            },
            state,
            bundle,
          )
        )?.body,
      ),
      createdAt = new Date().toISOString();
    values[id.data] = ImpactCalibrationReceiptSchema.parse({
      id: id.data,
      createdAt,
      input,
      equity,
      factor,
      result: calibrateImpact(equity, factor, createdAt),
    });
  } else if (request.method === 'DELETE') {
    if (!Object.hasOwn(values, id.data)) fail(404, 'Calibration not found.');
    values[id.data] = null;
  } else fail(404, 'Unknown calibration operation.');
  const all = (state.data.localImpactCalibrations ?? {}) as Record<
    string,
    Record<string, Receipt | null>
  >;
  all[user.id] = values;
  state.data.localImpactCalibrations = all;
  return {
    body: request.method === 'DELETE' ? { deleted: true } : values[id.data],
  };
};

import { admitAdjustmentCoverage } from './equity-adjustments.js';
import { decryptHoldingsRows } from './private-holdings.js';
import {
  sealPrivateJson,
  openPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  BadRequestException,
  ConflictException,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  ImpactCalibrationInputSchema,
  ImpactCalibrationReceiptSchema,
  ImpactCalibrationListSchema,
  HoldingsSnapshotSchema,
  calibrateImpact,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { EcbFxStore, ECB_FX_STORE } from './ecb-fx.js';
import { equityCompanyForTrace } from './equity-coverage.js';
import type pg from 'pg';
export async function exportImpactCalibrations(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  return ImpactCalibrationListSchema.parse({
    receipts: await Promise.all(
      (
        await c.query(
          'SELECT id,encrypted_payload FROM app_impact_calibrations WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 50 FOR UPDATE',
          [userId],
        )
      ).rows.map((row) => readCalibration(c, userId, row, keys)),
    ),
  });
}
async function readCalibration(
  c: pg.PoolClient,
  userId: string,
  row: { id: string; encrypted_payload: unknown },
  keys: PrivateDataKeys,
) {
  const receipt = ImpactCalibrationReceiptSchema.parse(
    openPrivateJson(
      'impact-calibration',
      userId,
      row.id,
      row.encrypted_payload,
      keys,
    ),
  );
  if (receipt.id !== row.id)
    throw new ConflictException('Calibration identity mismatch.');
  if (privatePayloadNeedsRotation(row.encrypted_payload, keys))
    await c.query(
      'UPDATE app_impact_calibrations SET encrypted_payload=$3 WHERE user_id=$1 AND id=$2',
      [
        userId,
        row.id,
        sealPrivateJson('impact-calibration', userId, row.id, receipt, keys),
      ],
    );
  return receipt;
}
@Controller('account/impact-calibrations')
export class ImpactCalibrationController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(ECB_FX_STORE) private readonly fx: EcbFxStore,
  ) {}
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie),
        result = await exportImpactCalibrations(
          c,
          user.id,
          this.store.privateDataKeys,
        );
      await this.store.require(c, cookie);
      return result;
    });
  }
  @Put(':id') save(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const id = z.uuid().safeParse(raw),
      input = ImpactCalibrationInputSchema.safeParse(body);
    if (!id.success || !input.success)
      throw new BadRequestException(
        'Choose a holding and consent to save calibration evidence.',
      );
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const old = (
        await c.query(
          'SELECT id,encrypted_payload,deleted_at FROM app_impact_calibrations WHERE user_id=$1 AND id=$2',
          [user.id, id.data],
        )
      ).rows[0];
      if (old) {
        if (old.deleted_at) throw new GoneException('Calibration deleted.');
        const receipt = await readCalibration(
          c,
          user.id,
          old,
          this.store.privateDataKeys,
        );
        if (receipt.input.isin !== input.data.isin)
          throw new ConflictException('Receipt ID belongs to another holding.');
        return receipt;
      }
      const holdingRows = await c.query(
        'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
        [user.id],
      );
      if (!holdingRows.rows.length)
        throw new ConflictException('Save holdings before calibrating.');
      await decryptHoldingsRows(
        c,
        user.id,
        holdingRows.rows,
        this.store.privateDataKeys,
      );
      const holdings = HoldingsSnapshotSchema.parse(
        holdingRows.rows[0]?.payload ?? {
          version: 0,
          holdings: [],
          totalCostMinor: '0',
          currency: 'INR',
          scale: 2,
        },
      );
      if (!holdings.holdings.some((item) => item.isin === input.data.isin))
        throw new ConflictException('Choose one of your saved holdings.');
      if (
        (
          await c.query(
            'SELECT count(*)::integer AS n FROM app_impact_calibrations WHERE user_id=$1 AND deleted_at IS NULL',
            [user.id],
          )
        ).rows[0].n >= 50
      )
        throw new ConflictException(
          'Remove a calibration before exceeding 50 receipts.',
        );
      const factor = await this.fx.publicView();
      const fxHead = (
        await c.query(
          'SELECT status,published_edition FROM ecb_fx_head FOR SHARE',
        )
      ).rows[0];
      if (
        (factor.status === 'published') !== (fxHead?.status === 'published') ||
        (factor.edition && factor.edition.edition !== fxHead?.published_edition)
      )
        throw new ConflictException(
          'FX publication changed. Retry calibration.',
        );
      await c.query(
        'SELECT e.id FROM equity_editions e WHERE EXISTS(SELECT 1 FROM equity_observations o WHERE o.edition_id=e.id AND o.isin=$1) ORDER BY e.id FOR SHARE',
        [input.data.isin],
      );
      let equity;
      try {
        equity = await equityCompanyForTrace(c, input.data.isin);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
        equity = null;
      }
      const dates =
        equity?.records
          .filter((row) => row.observation.kind === 'price')
          .map((row) => row.observation.effectiveOn)
          .sort() ?? [];
      const adjustmentCoverage =
        equity && dates.length
          ? await admitAdjustmentCoverage(c, equity, dates[0]!, dates.at(-1)!)
          : null;
      const createdAt = new Date().toISOString(),
        receipt = ImpactCalibrationReceiptSchema.parse({
          id: id.data,
          createdAt,
          input: input.data,
          equity,
          factor,
          adjustmentCoverage,
          result: calibrateImpact(
            equity,
            factor,
            createdAt,
            adjustmentCoverage,
          ),
        });
      await this.store.require(c, cookie);
      await c.query(
        'INSERT INTO app_impact_calibrations(user_id,id,encrypted_payload) VALUES($1,$2,$3)',
        [
          user.id,
          id.data,
          sealPrivateJson(
            'impact-calibration',
            user.id,
            id.data,
            receipt,
            this.store.privateDataKeys,
          ),
        ],
      );
      return receipt;
    });
  }
  @Delete(':id') remove(
    @Param('id') raw: string,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const id = z.uuid().safeParse(raw);
    if (!id.success)
      throw new BadRequestException('Invalid calibration receipt.');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const row = await c.query(
        'UPDATE app_impact_calibrations SET encrypted_payload=NULL,deleted_at=coalesce(deleted_at,clock_timestamp()) WHERE user_id=$1 AND id=$2 RETURNING id',
        [user.id, id.data],
      );
      if (!row.rowCount) throw new NotFoundException('Calibration not found.');
      return { deleted: true };
    });
  }
}

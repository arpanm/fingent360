import { decryptScheduleRows, sealSchedule } from './private-schedules.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  ConsentPurposeSchema,
  ConsentWriteSchema,
  ConsentReceiptSchema,
  ConsentListSchema,
  consentPurposes,
  consentStatus,
  consentActive,
  reviseConsent,
  ReportScheduleSchema,
  nextScheduleDue,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { readConsent, saveConsent, exportConsents } from './consent-store.js';

@Controller('account/consents')
export class ConsentsController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() list(
    @Query() query: Record<string, unknown>,
    @Headers('cookie') cookie?: string,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('Consent list does not accept filters.');
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const records = await Promise.all(
        consentPurposes.map((purpose) => readConsent(c, user.id, purpose)),
      );
      await this.account.require(c, cookie);
      const evaluatedAt = new Date().toISOString();
      return ConsentListSchema.parse({
        ownerId: user.id,
        evaluatedAt,
        purposes: records.map((record) => ({
          record,
          status: consentStatus(record, evaluatedAt),
        })),
      });
    });
  }
  @Get('history') history(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const result = await exportConsents(c, user.id, query);
      await this.account.require(c, cookie);
      return result;
    });
  }
  @Post(':purpose') change(
    @Param('purpose') rawPurpose: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    const purposeResult = ConsentPurposeSchema.safeParse(rawPurpose),
      parsed = ConsentWriteSchema.safeParse(body);
    if (!purposeResult.success || !parsed.success)
      throw new BadRequestException(
        'Review the purpose, expiry and consent decision.',
      );
    const purpose = purposeResult.data,
      input = parsed.data,
      request = { purpose, input };
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const prior = await c.query(
        'SELECT request,payload FROM account_consent_events WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      await this.account.require(c, cookie);
      if (prior.rows[0]) {
        // jsonb does not preserve object-key order.
        const match = await c.query(
          'SELECT request=$3::jsonb AS matches FROM account_consent_events WHERE user_id=$1 AND request_id=$2',
          [user.id, input.requestId, request],
        );
        await this.account.require(c, cookie);
        if (!match.rows[0]?.matches)
          throw new ConflictException(
            'Request ID belongs to another consent decision.',
          );
        return ConsentReceiptSchema.parse(prior.rows[0].payload);
      }
      const before = await readConsent(c, user.id, purpose);
      await this.account.require(c, cookie);
      if (before.version !== input.expectedVersion)
        throw new ConflictException(
          'Consent changed. Reload its current state before reviewing again.',
        );
      const at = new Date().toISOString();
      let receipt;
      try {
        receipt = reviseConsent(before, input, at);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid consent decision.',
        );
      }
      if (
        purpose === 'scheduled-record-reviews' &&
        input.action !== 'revoke' &&
        !consentActive(before, at)
      ) {
        const schedules = await c.query(
          "SELECT * FROM report_schedules WHERE user_id=$1 AND status='active' ORDER BY id FOR UPDATE",
          [user.id],
        );
        await decryptScheduleRows(
          c,
          'schedule-head',
          user.id,
          schedules.rows,
          this.account.privateDataKeys,
        );
        for (const row of schedules.rows) {
          const schedule = ReportScheduleSchema.parse(row.payload),
            nextDueAt = nextScheduleDue(
              schedule.config,
              new Date().toISOString(),
            );
          const encrypted = sealSchedule(
            'schedule-head',
            user.id,
            {
              ...schedule,
              nextDueAt,
              message:
                'Purpose renewed; next future occurrence. No catch-up for the consent lapse.',
            },
            this.account.privateDataKeys,
          );
          await c.query(
            'UPDATE report_schedules SET next_due_at=$2,payload=NULL,encrypted_payload=$3,content_hash=$5 WHERE id=$1 AND user_id=$4',
            [
              schedule.id,
              nextDueAt,
              encrypted.envelope,
              user.id,
              encrypted.hash,
            ],
          );
          receipt.scheduleEffects.push({ scheduleId: schedule.id, nextDueAt });
        }
      }
      receipt = ConsentReceiptSchema.parse(receipt);
      await saveConsent(c, user.id, receipt, request);
      await this.account.require(c, cookie);
      if (
        input.action !== 'revoke' &&
        !consentActive(receipt.state, new Date().toISOString())
      )
        throw new ConflictException(
          'Consent expired while saving. Review a new expiry.',
        );
      return receipt;
    });
  }
}

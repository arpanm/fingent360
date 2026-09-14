import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  MaterialError,
  MaterialReceiptSchema,
  MaterialViewSchema,
  MaterialWriteSchema,
  applyMaterial,
  syncMaterialContext,
  consentActive,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import {
  exportMaterial,
  materialContext,
  materialSources,
  readMaterial,
  saveMaterial,
} from './material-alert-store.js';
import {
  recordConsentOptIn,
  requireConsent,
  readConsent,
  ConsentUnavailable,
} from './consent-store.js';

@Controller('account/inbox/material')
export class MaterialAlertsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() read(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    if (!z.strictObject({}).safeParse(query).success)
      throw new BadRequestException('Invalid material inbox query.');
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(client, cookie);
      const state = await readMaterial(client, user.id),
        context = await materialContext(client, user.id);
      const sources = await materialSources(client),
        at = new Date().toISOString();
      const permission = await readConsent(
        client,
        user.id,
        'automatic-material-checks',
      );
      await this.store.require(client, cookie);
      // No rule has been saved yet; showing existing follow/mute choices has no write side effect.
      return MaterialViewSchema.parse({
        automaticPermissionCurrent:
          consentActive(permission, new Date().toISOString()) &&
          permission.version === state.automatic.consentVersion,
        state: state.version
          ? state
          : {
              ...state,
              followed: context.followed.sort(),
              muted: context.muted
                .filter((v) => context.followed.includes(v))
                .sort(),
            },
        sources,
        evaluatedAt: at,
        bundleGeneratedAt: null,
      });
    });
  }
  @Get('history') history(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(client, cookie);
      const result = await exportMaterial(client, user.id, query);
      await this.store.require(client, cookie);
      return result;
    });
  }
  @Post() @HttpCode(200) write(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const parsed = MaterialWriteSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Supply valid material-change settings and an exact request version.',
      );
    const input = parsed.data;
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.store.require(client, cookie);
      const prior = (
        await client.query(
          'SELECT request,payload FROM material_alert_events WHERE user_id=$1 AND request_id=$2',
          [user.id, input.requestId],
        )
      ).rows[0];
      if (prior) {
        const same = MaterialWriteSchema.safeParse(prior.request);
        if (
          !same.success ||
          JSON.stringify(same.data) !== JSON.stringify(input)
        )
          throw new ConflictException(
            'This request ID was already used for different material-change input.',
          );
        await this.store.require(client, cookie);
        return MaterialReceiptSchema.parse(prior.payload);
      }
      const previous = await readMaterial(client, user.id),
        context = await materialContext(client, user.id);
      const sources = await materialSources(client),
        at = new Date().toISOString();
      // First configuration can use the GET version0 while adopting the current watchlist.
      const state =
        previous.version === 0
          ? {
              ...previous,
              followed: context.followed.sort(),
              muted: context.muted
                .filter((v) => context.followed.includes(v))
                .sort(),
            }
          : syncMaterialContext(
              previous,
              context.followed,
              context.muted,
              sources,
              at,
            );
      try {
        let automaticConsentVersion: number | undefined;
        if (input.action === 'automatic-settings' && input.enabled) {
          await recordConsentOptIn(
            client,
            user.id,
            'automatic-material-checks',
            { kind: 'review', recordedAt: at },
          );
          automaticConsentVersion = (
            await requireConsent(client, user.id, 'automatic-material-checks')
          ).version;
        }
        const receipt = applyMaterial(
          state,
          input,
          sources,
          at,
          automaticConsentVersion,
        );
        await saveMaterial(client, user.id, receipt, input);
        const finalConsent =
          input.action === 'automatic-settings' && input.enabled
            ? await requireConsent(client, user.id, 'automatic-material-checks')
            : null;
        await this.store.require(client, cookie);
        if (
          finalConsent &&
          !consentActive(finalConsent, new Date().toISOString())
        )
          throw new ConsentUnavailable();
        return receipt;
      } catch (error) {
        if (error instanceof MaterialError)
          throw new HttpException(error.message, error.status);
        throw error;
      }
    });
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Put,
} from '@nestjs/common';
import {
  AlertPreferenceUpdateSchema,
  AlertPreferencesSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { syncMaterialAccount } from './material-alert-store.js';
@Controller('account/alert-preferences')
export class AlertPreferencesController {
  constructor(@Inject(STORE) private readonly accounts: AccountStore) {}
  @Get() get(@Headers('cookie') cookie?: string) {
    return this.accounts.transaction(async (client) => {
      const account = await this.accounts.require(client, cookie);
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        account.id,
      ]);
      await this.accounts.require(client, cookie);
      const result = await client.query<{
        indicator: string;
        muted: boolean;
        updated_at: Date | null;
      }>(
        `SELECT followed.indicator,COALESCE(p.muted,false) AS muted,p.updated_at FROM app_watchlists w CROSS JOIN LATERAL unnest(w.indicators) AS followed(indicator) LEFT JOIN app_alert_preferences p ON p.user_id=w.user_id AND p.indicator=followed.indicator WHERE w.user_id=$1 ORDER BY followed.indicator`,
        [account.id],
      );
      await this.accounts.require(client, cookie);
      return AlertPreferencesSchema.parse({
        preferences: result.rows.map((r) => ({
          indicator: r.indicator,
          muted: r.muted,
          updatedAt: r.updated_at?.toISOString() ?? null,
        })),
      });
    });
  }
  @Put() put(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.accounts.origin(origin);
    const parsed = AlertPreferenceUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Supply a supported followed indicator and a boolean mute setting.',
      );
    return this.accounts.transaction(async (client) => {
      const account = await this.accounts.require(client, cookie);
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      await this.accounts.require(client, cookie);
      const watchlist = await client.query<{ indicators: string[] }>(
        'SELECT indicators FROM app_watchlists WHERE user_id=$1 FOR UPDATE',
        [account.id],
      );
      if (!watchlist.rows[0]?.indicators.includes(parsed.data.indicator))
        throw new BadRequestException(
          'Follow this indicator before changing its inbox setting.',
        );
      await client.query(
        'INSERT INTO app_alert_preferences(user_id,indicator,muted) VALUES ($1,$2,$3) ON CONFLICT(user_id,indicator) DO UPDATE SET muted=excluded.muted,updated_at=now()',
        [account.id, parsed.data.indicator, parsed.data.muted],
      );
      await syncMaterialAccount(client, account.id);
      await this.accounts.require(client, cookie);
      return { ok: true as const };
    });
  }
}

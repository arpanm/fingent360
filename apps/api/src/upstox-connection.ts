import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  Res,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import {
  UpstoxConnectionStatusSchema,
  UpstoxStartSchema,
  UpstoxStartResultSchema,
  UpstoxFetchSchema,
  UpstoxCaptureSchema,
  UpstoxPreviewResultSchema,
  UpstoxRevokeSchema,
  UpstoxRevokedSchema,
  UpstoxExportSchema,
  holdingsTotal,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { HoldingsController } from './holdings.js';
import {
  UpstoxProvider,
  UpstoxVaultSchema,
  upstoxExpiry,
  parseUpstoxHoldings,
} from './upstox-provider.js';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
import type { AppConfig } from './config.js';
const UPSTOX = Symbol('UPSTOX_CONNECTION'),
  hash = (value: string) => createHash('sha256').update(value).digest('hex');
const warning =
  'Settled delivery holdings only. Cost is quantity × broker average price, rounded half-up per row to paise; this is not verified tradebook or tax cost. Our app never submits orders.';
function input<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      'Provide the required broker connection fields.',
    );
  return parsed.data;
}
function status(row: Record<string, unknown> | undefined, enabled: boolean) {
  const state = !row
    ? 'disconnected'
    : (row.state === 'connected' &&
          new Date(String(row.expires_at)).getTime() <= Date.now()) ||
        (row.state === 'pending' &&
          new Date(String(row.pending_until)).getTime() <= Date.now())
      ? 'expired'
      : row.state;
  return UpstoxConnectionStatusSchema.parse({
    enabled,
    state: enabled ? state : 'unconfigured',
    connectedAt: row?.connected_at
      ? new Date(String(row.connected_at)).toISOString()
      : null,
    expiresAt: row?.expires_at
      ? new Date(String(row.expires_at)).toISOString()
      : null,
    lastFetchedAt: row?.last_fetched_at
      ? new Date(String(row.last_fetched_at)).toISOString()
      : null,
    message: enabled
      ? warning
      : 'Broker connectivity awaits server app registration and retention permission. You can still import a reviewed file.',
  });
}
export async function exportUpstoxConnections(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
  enabled = false,
) {
  const connection = (
      await c.query(
        'SELECT state,pending_until,connected_at,expires_at,last_fetched_at FROM broker_upstox_connections WHERE user_id=$1',
        [userId],
      )
    ).rows[0],
    rows = (
      await c.query(
        'SELECT * FROM broker_upstox_captures WHERE user_id=$1 ORDER BY retrieved_at,id',
        [userId],
      )
    ).rows,
    captures = [];
  for (const row of rows) {
    const decoded = z
      .strictObject({
        raw: z.string().max(2000000),
        capture: UpstoxCaptureSchema,
      })
      .parse(
        openPrivateJson(
          'broker-upstox-capture',
          userId,
          row.id,
          row.encrypted_payload,
          keys,
        ),
      );
    if (
      decoded.capture.id !== row.id ||
      decoded.capture.sourceHash !== row.source_hash ||
      hash(decoded.raw) !== row.source_hash
    )
      throw new ServiceUnavailableException(
        'Broker capture integrity could not be verified.',
      );
    if (privatePayloadNeedsRotation(row.encrypted_payload, keys))
      await c.query(
        'UPDATE broker_upstox_captures SET encrypted_payload=$3 WHERE user_id=$1 AND id=$2',
        [
          userId,
          row.id,
          sealPrivateJson(
            'broker-upstox-capture',
            userId,
            row.id,
            decoded,
            keys,
          ),
        ],
      );
    captures.push({ ...decoded.capture, rawResponse: decoded.raw });
  }
  const events = (
    await c.query(
      'SELECT action,recorded_at FROM broker_upstox_events WHERE user_id=$1 ORDER BY recorded_at,id',
      [userId],
    )
  ).rows;
  return UpstoxExportSchema.parse({
    connection: status(connection, enabled),
    captures,
    events: events.map((r) => ({
      action: r.action,
      at: r.recorded_at.toISOString(),
    })),
  });
}
export class UpstoxConnectionStore {
  constructor(
    private readonly account: AccountStore,
    private readonly config: AppConfig,
    private readonly provider = new UpstoxProvider(
      config.UPSTOX_API_KEY || '',
      config.UPSTOX_API_SECRET || '',
      config.UPSTOX_REDIRECT_URL || '',
    ),
  ) {}
  enabled() {
    return !!(
      this.config.UPSTOX_ENABLED &&
      this.config.UPSTOX_API_KEY &&
      this.config.UPSTOX_API_SECRET &&
      this.config.UPSTOX_REDIRECT_URL &&
      this.config.UPSTOX_PERMISSION_REFERENCE
    );
  }
  private ready() {
    if (!this.enabled())
      throw new ServiceUnavailableException(
        'Broker connectivity is not activated. Configure the registered app and retention permission first.',
      );
    const redirect = new URL(this.config.UPSTOX_REDIRECT_URL!);
    if (
      redirect.pathname !==
        '/api/v1/account/broker-connections/upstox/callback' ||
      redirect.search ||
      redirect.hash ||
      redirect.username ||
      redirect.password ||
      (redirect.protocol !== 'https:' &&
        !['localhost', '127.0.0.1'].includes(redirect.hostname))
    )
      throw new ServiceUnavailableException(
        'Broker callback configuration is invalid.',
      );
  }
  returnUrl() {
    return new URL('/#holdings', this.config.WEB_ORIGIN).href;
  }
  async cancel(raw: unknown, cookie?: string) {
    const value = input(
      z.strictObject({ state: z.string().regex(/^[a-f0-9]{64}$/) }),
      raw,
    );
    await this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const result = await c.query(
        "UPDATE broker_upstox_connections SET state='revoked',state_hash=NULL,pending_until=NULL,version=version+1 WHERE user_id=$1 AND state_hash=$2 AND state='pending'",
        [user.id, hash(value.state)],
      );
      if (result.rowCount !== 1)
        throw new ConflictException(
          'This pending connection was already completed, cancelled or replaced. Refresh broker status.',
        );
      await c.query(
        'INSERT INTO broker_upstox_events(id,user_id,action) VALUES($1,$2,$3)',
        [randomUUID(), user.id, 'connection-cancelled'],
      );
    });
    return { cancelled: true };
  }
  callbackOrigin(origin?: string) {
    if (
      !origin ||
      ![
        this.config.WEB_ORIGIN,
        new URL(this.config.UPSTOX_REDIRECT_URL || this.config.WEB_ORIGIN)
          .origin,
      ].includes(origin)
    )
      throw new BadRequestException('Broker callback origin is not allowed.');
  }
  async read(cookie?: string) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query(
        "UPDATE broker_upstox_connections SET state='expired',encrypted_token=NULL,state_hash=NULL WHERE user_id=$1 AND ((state='connected' AND expires_at<=clock_timestamp()) OR (state='pending' AND pending_until<=clock_timestamp()))",
        [user.id],
      );
      return status(
        (
          await c.query(
            'SELECT state,pending_until,connected_at,expires_at,last_fetched_at FROM broker_upstox_connections WHERE user_id=$1',
            [user.id],
          )
        ).rows[0],
        this.enabled(),
      );
    });
  }
  async start(raw: unknown, cookie?: string) {
    input(UpstoxStartSchema, raw);
    this.ready();
    const nonce = randomBytes(32).toString('hex'),
      until = new Date(Date.now() + 600000).toISOString();
    await this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const previous = (
        await c.query(
          'SELECT state,expires_at FROM broker_upstox_connections WHERE user_id=$1',
          [user.id],
        )
      ).rows[0];
      if (
        previous?.state === 'connected' &&
        new Date(previous.expires_at).getTime() > Date.now()
      )
        throw new ConflictException(
          'Revoke the existing broker connection before reconnecting.',
        );
      const attempts = await c.query(
        "SELECT count(*)::int AS count FROM broker_upstox_events WHERE user_id=$1 AND action='connection-consent' AND recorded_at>now()-interval '1 day'",
        [user.id],
      );
      if (attempts.rows[0].count >= 20)
        throw new ConflictException(
          'Connection attempt limit reached. Retry tomorrow.',
        );
      await c.query(
        "INSERT INTO broker_upstox_connections(user_id,state,state_hash,pending_until,permission_reference) VALUES($1,'pending',$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET state='pending',version=broker_upstox_connections.version+1,state_hash=$2,pending_until=$3,encrypted_token=NULL,expires_at=NULL,permission_reference=$4",
        [user.id, hash(nonce), until, this.config.UPSTOX_PERMISSION_REFERENCE],
      );
      await c.query(
        'INSERT INTO broker_upstox_events(id,user_id,action) VALUES($1,$2,$3)',
        [randomUUID(), user.id, 'connection-consent'],
      );
    });
    const url = new URL('https://api.upstox.com/v2/login/authorization/dialog');
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.UPSTOX_API_KEY!,
      redirect_uri: this.config.UPSTOX_REDIRECT_URL!,
      state: nonce,
    }).toString();
    return UpstoxStartResultSchema.parse({
      loginUrl: url.href,
      expiresAt: until,
    });
  }
  async callback(query: unknown, cookie?: string) {
    this.ready();
    const value = input(
      z.strictObject({
        code: z.string().regex(/^[A-Za-z0-9._~-]{1,512}$/),
        state: z.string().regex(/^[a-f0-9]{64}$/),
      }),
      query,
    );
    const claim = await this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const row = (
        await c.query(
          "UPDATE broker_upstox_connections SET state_hash=NULL WHERE state_hash=$1 AND user_id=$2 AND state='pending' AND pending_until>clock_timestamp() RETURNING user_id,version",
          [hash(value.state), user.id],
        )
      ).rows[0];
      if (!row)
        throw new ConflictException(
          'Connection request expired or was already used. Return to Holdings and reconnect.',
        );
      return row;
    });
    let vault;
    try {
      vault = await this.provider.exchange(value.code);
    } catch {
      throw new ServiceUnavailableException(
        'Broker authorization could not be completed. Return to Holdings and reconnect.',
      );
    }
    try {
      await this.account.transaction(async (c) => {
        await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
          claim.user_id,
        ]);
        const admitted = await this.account.require(c, cookie);
        if (admitted.id !== claim.user_id)
          throw new ConflictException(
            'Connection owner changed. Reconnect from Holdings.',
          );
        const result = await c.query(
          "UPDATE broker_upstox_connections SET state='connected',encrypted_token=$3,connected_at=clock_timestamp(),expires_at=$4,pending_until=NULL WHERE user_id=$1 AND version=$2 AND state='pending' AND pending_until>clock_timestamp()",
          [
            claim.user_id,
            claim.version,
            sealPrivateJson(
              'broker-upstox-token',
              claim.user_id,
              claim.user_id,
              vault,
              this.account.privateDataKeys,
            ),
            upstoxExpiry(),
          ],
        );
        if (result.rowCount !== 1)
          throw new ConflictException(
            'Connection was cancelled or expired. Reconnect from Holdings.',
          );
        await c.query(
          'INSERT INTO broker_upstox_events(id,user_id,action) VALUES($1,$2,$3)',
          [randomUUID(), claim.user_id, 'connected'],
        );
      });
    } catch (error) {
      await this.provider.revoke(vault).catch(() => {});
      throw error;
    }
    return this.config.WEB_ORIGIN.replace(/\/$/, '') + '/#holdings';
  }
  async fetch(raw: unknown, cookie?: string) {
    const value = input(UpstoxFetchSchema, raw);
    this.ready();
    const claim = await this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const row = (
        await c.query(
          "SELECT * FROM broker_upstox_connections WHERE user_id=$1 AND state='connected' AND expires_at>clock_timestamp() FOR UPDATE",
          [user.id],
        )
      ).rows[0];
      if (!row)
        throw new ConflictException(
          'Broker connection expired or was revoked. Reconnect first.',
        );
      const vault = UpstoxVaultSchema.parse(
        openPrivateJson(
          'broker-upstox-token',
          user.id,
          user.id,
          row.encrypted_token,
          this.account.privateDataKeys,
        ),
      );
      if (
        privatePayloadNeedsRotation(
          row.encrypted_token,
          this.account.privateDataKeys,
        )
      )
        await c.query(
          'UPDATE broker_upstox_connections SET encrypted_token=$3 WHERE user_id=$1 AND version=$2',
          [
            user.id,
            row.version,
            sealPrivateJson(
              'broker-upstox-token',
              user.id,
              user.id,
              vault,
              this.account.privateDataKeys,
            ),
          ],
        );
      return { userId: user.id, version: row.version, vault };
    });
    let rawResponse: string;
    try {
      rawResponse = await this.provider.holdings(claim.vault);
    } catch {
      throw new ServiceUnavailableException(
        'Broker holdings are unavailable. Reconnect or retry; saved holdings were not changed.',
      );
    }
    let holdings;
    try {
      holdings = parseUpstoxHoldings(rawResponse);
    } catch {
      throw new BadRequestException(
        'Broker holdings contain unsupported, unsettled, duplicate or discrepant data. Use a reviewed file import; no holdings changed.',
      );
    }
    const id = randomUUID(),
      capture = UpstoxCaptureSchema.parse({
        id,
        provider: 'upstox',
        parserVersion: 'upstox-settled-holdings-v1',
        retrievedAt: new Date().toISOString(),
        sourceUrl: 'https://api.upstox.com/v2/portfolio/long-term-holdings',
        sourceHash: hash(rawResponse),
        holdings,
        rounding: 'per-row-half-up-paise',
        costBasis: 'broker-average-price-unverified',
        warning,
      });
    const preview = await new HoldingsController(this.account).createPreview(
      holdings,
      {
        parserVersion: 'upstox-settled-holdings-v1',
        declaredRowCount: holdings.length,
        declaredTotalMinor: holdingsTotal(holdings),
      },
      value.expectedVersion,
      cookie,
      async (c, userId, previewId) => {
        const current = await c.query(
          "UPDATE broker_upstox_connections SET last_fetched_at=clock_timestamp() WHERE user_id=$1 AND version=$2 AND state='connected' AND expires_at>clock_timestamp() RETURNING user_id",
          [userId, claim.version],
        );
        if (current.rowCount !== 1)
          throw new ConflictException(
            'Connection was revoked or expired during retrieval. No preview was saved.',
          );
        const count = await c.query(
          'SELECT count(*)::int AS count FROM broker_upstox_captures WHERE user_id=$1',
          [userId],
        );
        if (count.rows[0].count >= 100)
          throw new ConflictException(
            'Broker capture limit reached. Export and delete broker data before fetching again.',
          );
        await c.query(
          'INSERT INTO broker_upstox_captures(id,user_id,preview_id,encrypted_payload,source_hash,retrieved_at) VALUES($1,$2,$3,$4,$5,$6)',
          [
            id,
            userId,
            previewId,
            sealPrivateJson(
              'broker-upstox-capture',
              userId,
              id,
              { raw: rawResponse, capture },
              this.account.privateDataKeys,
            ),
            capture.sourceHash,
            capture.retrievedAt,
          ],
        );
        await c.query(
          'INSERT INTO broker_upstox_events(id,user_id,action) VALUES($1,$2,$3)',
          [randomUUID(), userId, 'holdings-preview'],
        );
        await this.account.require(c, cookie);
      },
    );
    return UpstoxPreviewResultSchema.parse({ capture, preview });
  }
  async revoke(raw: unknown, cookie?: string) {
    input(UpstoxRevokeSchema, raw);
    let vault: z.infer<typeof UpstoxVaultSchema> | null = null;
    await this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const row = (
        await c.query(
          'SELECT state,encrypted_token FROM broker_upstox_connections WHERE user_id=$1 FOR UPDATE',
          [user.id],
        )
      ).rows[0];
      if (!row || row.state === 'revoked') return;
      if (row?.encrypted_token) {
        try {
          vault = UpstoxVaultSchema.parse(
            openPrivateJson(
              'broker-upstox-token',
              user.id,
              user.id,
              row.encrypted_token,
              this.account.privateDataKeys,
            ),
          );
        } catch {
          /* Local revocation must still work when token keys are unavailable. */
        }
      }
      await c.query(
        "UPDATE broker_upstox_connections SET state='revoked',version=version+1,encrypted_token=NULL,state_hash=NULL,pending_until=NULL WHERE user_id=$1",
        [user.id],
      );
      await c.query(
        'DELETE FROM app_holdings_previews WHERE user_id=$1 AND confirmed_version IS NULL AND id IN (SELECT preview_id FROM broker_upstox_captures WHERE user_id=$1)',
        [user.id],
      );
      await c.query(
        'INSERT INTO broker_upstox_events(id,user_id,action) VALUES($1,$2,$3)',
        [randomUUID(), user.id, 'revoked'],
      );
    });
    let remote: 'confirmed' | 'unavailable' | 'not-needed' = vault
      ? 'unavailable'
      : 'not-needed';
    if (vault)
      try {
        await this.provider.revoke(vault);
        remote = 'confirmed';
      } catch {
        /* Local token has already been destroyed. */
      }
    return UpstoxRevokedSchema.parse({
      revoked: true,
      remote,
      message:
        remote === 'confirmed'
          ? 'Connection revoked. Saved confirmed holdings remain.'
          : 'Local connection revoked. Use Upstox logout to invalidate any remaining broker session; saved confirmed holdings remain.',
    });
  }
  async export(cookie?: string) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      return exportUpstoxConnections(
        c,
        user.id,
        this.account.privateDataKeys,
        this.enabled(),
      );
    });
  }
  async remove(raw: unknown, cookie?: string) {
    await this.revoke(raw, cookie);
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('DELETE FROM broker_upstox_captures WHERE user_id=$1', [
        user.id,
      ]);
      await c.query('DELETE FROM broker_upstox_events WHERE user_id=$1', [
        user.id,
      ]);
      await c.query('DELETE FROM broker_upstox_connections WHERE user_id=$1', [
        user.id,
      ]);
      return { deleted: true };
    });
  }
}
@Controller('account/broker-connections/upstox')
export class UpstoxConnectionController {
  constructor(
    @Inject(UPSTOX) private readonly store: UpstoxConnectionStore,
    @Inject(STORE) private readonly account: AccountStore,
  ) {}
  @Get() read(@Headers('cookie') cookie?: string) {
    return this.store.read(cookie);
  }
  @Post('cancel') async cancel(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Res()
    res: {
      setHeader(name: string, value: string): void;
      redirect(status: number, url: string): void;
      json(value: unknown): void;
    },
  ) {
    this.store.callbackOrigin(origin);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const result = await this.store.cancel(body, cookie);
    if (accept?.includes('application/json')) res.json(result);
    else res.redirect(303, this.store.returnUrl());
  }
  @Post('start') start(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.start(body, cookie);
  }
  @Get('callback') callback(
    @Query() query: unknown,
    @Res()
    res: {
      setHeader(name: string, value: string): void;
      send(html: string): void;
    },
  ) {
    const parsed = z
      .strictObject({
        code: z.string().regex(/^[A-Za-z0-9._~-]{1,512}$/),
        state: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .safeParse(query);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (!parsed.success) {
      const state =
        query &&
        typeof query === 'object' &&
        'state' in query &&
        typeof query.state === 'string' &&
        /^[a-f0-9]{64}$/.test(query.state)
          ? query.state
          : null;
      res.send(
        `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Broker authorization incomplete</title><main><h1>Broker authorization was not completed</h1><p>No broker access has been saved by this callback. Return to Holdings and refresh or revoke the pending connection. On mobile, return to the app using the app switcher.</p>${state ? `<form method="post" action="/api/v1/account/broker-connections/upstox/cancel"><input type="hidden" name="state" value="${state}"><button type="submit">Cancel pending connection</button></form>` : ''}<p><a href="${this.store.returnUrl()}">Return to Holdings</a></p></main></html>`,
      );
      return;
    }
    const value = parsed.data;
    res.send(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm broker connection</title><main><h1>Complete your Upstox connection</h1><p>Continue only if you started this connection in your signed-in Fingent360 account. Broker passwords and OTPs stay with Upstox.</p><form method="post" action="/api/v1/account/broker-connections/upstox/complete"><input type="hidden" name="state" value="${value.state}"><input type="hidden" name="code" value="${value.code}"><button type="submit">Complete connection</button></form><p><a href="fingent360://broker-upstox?state=${value.state}&amp;code=${value.code}">Return to Fingent360 app</a></p><p>If your session expired, sign in to Fingent360 and start again. After completion, return to the app and refresh broker status.</p></main></html>`,
    );
  }
  @Post('complete') async complete(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Res()
    res: {
      setHeader(name: string, value: string): void;
      redirect(status: number, url: string): void;
      json(value: unknown): void;
    },
  ) {
    this.store.callbackOrigin(origin);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const destination = await this.store.callback(body, cookie);
    if (accept?.includes('application/json')) res.json({ connected: true });
    else res.redirect(303, destination);
  }
  @Post('preview') preview(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.fetch(body, cookie);
  }
  @Post('revoke') revoke(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.revoke(body, cookie);
  }
  @Post('delete') remove(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.remove(body, cookie);
  }
  @Get('export') export(@Headers('cookie') cookie?: string) {
    return this.store.export(cookie);
  }
}
export function upstoxConnectionProvider(config: AppConfig) {
  return {
    provide: UPSTOX,
    inject: [STORE],
    useFactory: (account: AccountStore) =>
      new UpstoxConnectionStore(account, config),
  };
}

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  NamedOperatorLoginSchema,
  OperatorCreateSchema,
  OperatorUpdateSchema,
  OperatorIdentitySchema,
  OperatorRosterSchema,
  type OperatorRole,
} from '@fingent360/contracts';
import {
  derivePassword,
  matchesPassword,
  newSalt,
} from './account-security.js';
import type { AppConfig } from './config.js';
export const namedSessionCondition = `(operator_id IS NULL OR EXISTS (
 SELECT 1 FROM named_operators identity WHERE identity.id=operator_sessions.operator_id
 AND identity.enabled AND identity.version=operator_sessions.operator_version))`;
export const permissionRoles = {
  read: ['viewer', 'researcher', 'publisher', 'admin'],
  prepare: ['researcher', 'admin'],
  approve: ['publisher', 'admin'],
  administer: ['admin'],
  blocked: [],
} satisfies Record<string, OperatorRole[]>;
export type OperatorPermission = keyof typeof permissionRoles;
export const operatorHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function operatorCookieHash(cookie?: string) {
  const values = (cookie ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.startsWith('f360_ops='));
  return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]!.slice(9))
    ? operatorHash(values[0]!.slice(9))
    : null;
}
export function operatorIdentity(row: Record<string, unknown>) {
  return OperatorIdentitySchema.parse({
    id: row.id,
    username: row.username,
    role: row.role,
    version: row.version,
    enabled: row.enabled,
    createdAt: (row.created_at as Date).toISOString(),
  });
}
export async function requireNamed(
  c: pg.PoolClient,
  actor: string | null,
  permission: OperatorPermission = 'read',
  lock = false,
) {
  const result = await c.query(
    `SELECT identity.*,s.expires_at FROM operator_sessions s JOIN named_operators identity ON identity.id=s.operator_id
     WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() AND identity.enabled AND identity.version=s.operator_version${lock ? ' FOR SHARE OF identity' : ''}`,
    [actor],
  );
  if (!result.rows[0])
    throw new UnauthorizedException('Sign in to named operations.');
  const identity = operatorIdentity(result.rows[0]);
  if (
    !(permissionRoles[permission] as readonly string[]).includes(identity.role)
  )
    throw new ForbiddenException(
      'Your operator role does not permit this action.',
    );
  return {
    identity,
    expiresAt: result.rows[0].expires_at.toISOString() as string,
  };
}
export class NamedOperatorStore {
  private readonly pool: pg.Pool;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
  }
  async close() {
    await this.pool.end();
  }
  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Named operations unavailable. Apply migration038 and retry.',
      );
    } finally {
      client?.release();
    }
  }
  async require(
    cookie: string | undefined,
    permission: OperatorPermission = 'read',
    client?: pg.PoolClient,
  ) {
    if (client)
      return requireNamed(client, operatorCookieHash(cookie), permission);
    return this.transaction((client) =>
      requireNamed(client, operatorCookieHash(cookie), permission),
    );
  }
  async session(cookie?: string) {
    try {
      const value = await this.require(cookie);
      return { authenticated: true, mode: 'named' as const, ...value };
    } catch (error) {
      if (error instanceof UnauthorizedException)
        return {
          authenticated: false,
          expiresAt: null,
          mode: 'named' as const,
          identity: null,
        };
      throw error;
    }
  }
  async login(body: unknown, client: string) {
    const parsed = NamedOperatorLoginSchema.safeParse(body),
      clientHash = operatorHash('named:' + client);
    // Failed-attempt reservation survives wrong credentials; no raw identifier is logged.
    await this.transaction(async (c) => {
      const limit = await c.query(
        "INSERT INTO operator_login_limits(client_hash,attempts,reset_at) VALUES($1,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(client_hash) DO UPDATE SET attempts=CASE WHEN operator_login_limits.reset_at<=clock_timestamp() THEN 1 ELSE operator_login_limits.attempts+1 END,reset_at=CASE WHEN operator_login_limits.reset_at<=clock_timestamp() THEN clock_timestamp()+interval '15 minutes' ELSE operator_login_limits.reset_at END RETURNING attempts",
        [clientHash],
      );
      if (limit.rows[0].attempts > 20)
        throw new HttpException(
          'Too many named sign-in attempts. Retry later.',
          429,
        );
    });
    if (!parsed.success)
      throw new UnauthorizedException('Named credentials are incorrect.');
    const row = await this.transaction(
      async (c) =>
        (
          await c.query('SELECT * FROM named_operators WHERE username=$1', [
            parsed.data.username,
          ])
        ).rows[0],
    );
    const derived = await derivePassword(
      parsed.data.password,
      row?.password_salt ?? '0'.repeat(64),
    );
    if (!row || !row.enabled || !matchesPassword(derived, row.password_hash))
      throw new UnauthorizedException('Named credentials are incorrect.');
    return this.transaction(async (c) => {
      const current = await c.query(
        'SELECT * FROM named_operators WHERE id=$1 FOR SHARE',
        [row.id],
      );
      if (!current.rows[0]?.enabled || current.rows[0].version !== row.version)
        throw new UnauthorizedException('Credentials changed. Sign in again.');
      const token = randomBytes(32).toString('hex');
      await c.query(
        "INSERT INTO operator_sessions(token_hash,expires_at,operator_id,operator_version) VALUES($1,clock_timestamp()+interval '1 hour',$2,$3)",
        [operatorHash(token), row.id, row.version],
      );
      await c.query('DELETE FROM operator_login_limits WHERE client_hash=$1', [
        clientHash,
      ]);
      return token;
    });
  }
  roster(cookie?: string) {
    return this.transaction(async (c) => {
      await requireNamed(c, operatorCookieHash(cookie), 'administer');
      const rows = await c.query(
        'SELECT * FROM named_operators ORDER BY username LIMIT 50',
      );
      await requireNamed(c, operatorCookieHash(cookie), 'administer');
      return OperatorRosterSchema.parse({
        operators: rows.rows.map(operatorIdentity),
      });
    });
  }
  async create(body: unknown, cookie?: string) {
    const parsed = OperatorCreateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Use a unique lowercase username, role and password of12–128 characters.',
      );
    await this.require(cookie, 'administer');
    const salt = newSalt(),
      password = await derivePassword(parsed.data.password, salt);
    return this.transaction(async (c) => {
      await c.query('SELECT id FROM named_operator_gate WHERE id=1 FOR UPDATE');
      const actor = await requireNamed(
        c,
        operatorCookieHash(cookie),
        'administer',
      );
      const count = await c.query(
        'SELECT count(*)::integer AS n FROM named_operators',
      );
      if (count.rows[0].n >= 50)
        throw new ConflictException(
          '50 named identities retained. Re-enable an existing identity; contact the database owner for a reviewed recovery.',
        );
      const duplicate = await c.query(
        'SELECT id FROM named_operators WHERE username=$1',
        [parsed.data.username],
      );
      if (duplicate.rows[0])
        throw new ConflictException('Username already exists.');
      const rows = await c.query(
        'INSERT INTO named_operators(id,username,password_hash,password_salt,role) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [randomUUID(), parsed.data.username, password, salt, parsed.data.role],
      );
      const identity = operatorIdentity(rows.rows[0]);
      await c.query(
        'INSERT INTO named_operator_changes(operator_id,actor_id,payload) VALUES($1,$2,$3)',
        [identity.id, actor.identity.id, { action: 'created', identity }],
      );
      await requireNamed(c, operatorCookieHash(cookie), 'administer', true);
      return identity;
    });
  }
  update(id: string, body: unknown, cookie?: string) {
    const parsed = OperatorUpdateSchema.safeParse(body);
    if (
      !parsed.success ||
      !OperatorIdentitySchema.shape.id.safeParse(id).success
    )
      throw new BadRequestException('Invalid operator revision.');
    id = id.toLowerCase();
    return this.transaction(async (c) => {
      await c.query('SELECT id FROM named_operator_gate WHERE id=1 FOR UPDATE');
      const actor = await requireNamed(
        c,
        operatorCookieHash(cookie),
        'administer',
      );
      const found = await c.query(
        'SELECT * FROM named_operators WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!found.rows[0]) throw new NotFoundException('Operator not found.');
      if (actor.identity.id === id)
        throw new ForbiddenException(
          'Ask another administrator to change your own role or disable your identity.',
        );
      if (found.rows[0].version !== parsed.data.expectedVersion)
        throw new ConflictException('Operator changed. Reload roster.');
      if (
        found.rows[0].enabled &&
        found.rows[0].role === 'admin' &&
        (!parsed.data.enabled || parsed.data.role !== 'admin')
      ) {
        const admins = await c.query(
          "SELECT count(*)::integer AS n FROM named_operators WHERE enabled AND role='admin'",
        );
        if (admins.rows[0].n <= 1)
          throw new ConflictException(
            'Keep at least one enabled administrator.',
          );
      }
      // Revision fencing invalidates sessions without waiting for their row-share locks.
      // Final public mutation admission holds the identity briefly, so committed changes fence later admissions.
      await requireNamed(c, operatorCookieHash(cookie), 'administer');
      const rows = await c.query(
        'UPDATE named_operators SET role=$2,enabled=$3,version=version+1 WHERE id=$1 RETURNING *',
        [id, parsed.data.role, parsed.data.enabled],
      );
      const identity = operatorIdentity(rows.rows[0]);
      await c.query(
        'INSERT INTO named_operator_changes(operator_id,actor_id,payload) VALUES($1,$2,$3)',
        [id, actor.identity.id, { action: 'updated', identity }],
      );
      await requireNamed(c, operatorCookieHash(cookie), 'administer', true);
      return identity;
    });
  }
}

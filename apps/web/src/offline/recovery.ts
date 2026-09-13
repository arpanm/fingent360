import {
  RecoveryGenerateSchema,
  RecoveryResetSchema,
  RecoveryStatusSchema,
  RecoveryCreatedSchema,
} from '@fingent360/contracts';
import {
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
import {
  currentLocalAccount,
  hashLocalPassword,
  matchesLocalPassword,
} from './accounts';
interface Recovery {
  codeHash: string;
  createdAt: string;
  consumedAt: string | null;
}
const hex = (bytes: Uint8Array) =>
  [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
const hash = async (value: string) =>
  hex(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  );
const error = (status: number, message: string): OfflineResult => ({
  status,
  body: {
    message,
    statusCode: status,
    error: status === 429 ? 'Too Many Requests' : 'Unauthorized',
  },
});
async function consume(
  state: LocalState,
  keys: { key: string; max: number }[],
) {
  const all = (state.data.localRecoveryLimits ??= {}) as Record<
    string,
    { count: number; until: number }
  >;
  const now = Date.now();
  for (const [key, value] of Object.entries(all))
    if (value.until <= now) delete all[key];
  // withState serializes this whole operation. The caller supplies the device
  // budget first, so blocked traffic never allocates another username counter.
  for (const item of keys) {
    const key = await hash(item.key);
    const existing = all[key];
    if (existing && existing.count >= item.max) return false;
    const counter = (all[key] ??= { count: 0, until: now + 900000 });
    counter.count++;
  }
  return true;
}
export async function handleRecovery(
  req: OfflineRequest,
  state: LocalState,
  _bundle: OfflineBundle,
): Promise<OfflineResult | undefined> {
  void _bundle;
  const base = '/api/v1/account/recovery';
  if (req.path !== base && !req.path.startsWith(base + '/')) return undefined;
  const all = (state.data.localRecovery ??= {}) as Record<string, Recovery>;
  if (req.method === 'GET' && req.path === base) {
    const user = currentLocalAccount(state);
    if (!user) fail(401, 'Sign in to manage recovery.');
    const item = all[user.id];
    return {
      body: RecoveryStatusSchema.parse({
        configured: !!item && !item.consumedAt,
        createdAt: item?.createdAt ?? null,
      }),
    };
  }
  if (req.method === 'POST' && req.path === base + '/code') {
    const input = RecoveryGenerateSchema.parse(req.body),
      user = currentLocalAccount(state);
    if (!user) fail(401, 'Sign in to manage recovery.');
    if (!(await consume(state, [{ key: `generate:${user.id}`, max: 5 }])))
      return error(429, 'Too many recovery attempts. Retry after 15 minutes.');
    if (!(await matchesLocalPassword(input.currentPassword, user)))
      return error(401, 'Current password is incorrect.');
    const code = hex(crypto.getRandomValues(new Uint8Array(32))),
      createdAt = new Date().toISOString();
    all[user.id] = { codeHash: await hash(code), createdAt, consumedAt: null };
    return {
      status: 201,
      body: RecoveryCreatedSchema.parse({ code, createdAt }),
    };
  }
  if (req.method === 'POST' && req.path === base + '/reset') {
    const input = RecoveryResetSchema.parse(req.body);
    if (
      !(await consume(state, [
        { key: 'reset-device', max: 30 },
        { key: `reset-user:${input.username}`, max: 5 },
      ]))
    )
      return error(429, 'Too many recovery attempts. Retry after 15 minutes.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16))),
      password = await hashLocalPassword(input.newPassword, salt),
      actual = await hash(input.code);
    const user = Object.values(state.users).find(
        (v) => v.username === input.username,
      ),
      record = user ? all[user.id] : undefined;
    const expected = record?.codeHash ?? '0'.repeat(64);
    let diff = 0;
    for (let i = 0; i < 64; i++)
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    if (!user || !record || record.consumedAt || diff !== 0)
      return error(
        401,
        'Recovery could not be completed. Check the username and recovery code.',
      );
    record.consumedAt = new Date().toISOString();
    user.passwordHash = password;
    user.passwordSalt = salt;
    if (state.sessionUserId === user.id) state.sessionUserId = null;
    const accounts = state.data.localAccounts as
      Record<string, { session: unknown }> | undefined;
    if (accounts?.[user.id]) accounts[user.id]!.session = null;
    const limits = state.data.localLoginAttempts as
      Record<string, unknown> | undefined;
    if (limits) delete limits[user.username];
    return { body: { ok: true } };
  }
  return undefined;
}

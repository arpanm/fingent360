import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
let activeHashes = 0;
export async function derivePassword(
  password: string,
  salt: string,
): Promise<string> {
  if (activeHashes >= 2)
    throw new ServiceUnavailableException(
      'Sign-in is busy. Please retry shortly.',
    );
  activeHashes++;
  try {
    const value = await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
    return value.toString('hex');
  } finally {
    activeHashes--;
  }
}
export const newSalt = () => randomBytes(32).toString('hex');
export const sessionHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function matchesPassword(actual: string, expected: string) {
  return (
    /^[a-f0-9]{128}$/.test(actual) &&
    /^[a-f0-9]{128}$/.test(expected) &&
    timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
  );
}
export function sessionFromCookie(cookie?: string): string | null {
  const values = (cookie ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith('f360_session='));
  if (values.length !== 1) return null;
  const value = values[0]?.slice('f360_session='.length) ?? '';
  return /^[a-f0-9]{64}$/.test(value) ? sessionHash(value) : null;
}
export function checkOrigin(origin: string | undefined, webOrigin: string) {
  const allowed = new URL(webOrigin);
  const origins = new Set([allowed.origin]);
  if (['localhost', '127.0.0.1'].includes(allowed.hostname)) {
    const alias = new URL(allowed);
    alias.hostname =
      allowed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.add(alias.origin);
  }
  if (!origin || !origins.has(origin))
    throw new ForbiddenException(
      'Account changes require the configured web origin.',
    );
}
export class AccountRateLimit {
  constructor(private readonly capacity = 120) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new Error('Rate limit capacity must be a positive integer.');
  }
  private readonly clients = new Map<
    string,
    { count: number; until: number }
  >();
  consume(client: string) {
    const now = Date.now();
    for (const [key, value] of this.clients)
      if (value.until <= now) this.clients.delete(key);
    const key = sessionHash(client);
    const current = this.clients.get(key);
    if (current && current.count >= this.capacity)
      throw new HttpException(
        'Too many account attempts. Retry after 15 minutes.',
        429,
      );
    if (!current && this.clients.size >= 4096)
      throw new ServiceUnavailableException(
        'Account service is busy. Retry later.',
      );
    this.clients.set(key, {
      count: (current?.count ?? 0) + 1,
      until: current?.until ?? now + 900000,
    });
  }
}

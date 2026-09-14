import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { NamedOperatorLoginSchema } from '@fingent360/contracts';
import { databaseTarget } from './database-roles.js';
import { derivePassword, newSalt } from './account-security.js';
import { operatorIdentity } from './named-operator-store.js';

export class ProvisionInputError extends Error {}

/** Explicit local owner-only setup/recovery. Never invoked by application startup. */
export async function provisionNamedAdministrator(
  ownerUrl: string,
  credentials: unknown,
  recover = false,
) {
  const target = databaseTarget(ownerUrl, true);
  const input = NamedOperatorLoginSchema.safeParse(credentials);
  if (!input.success)
    throw Error(
      'Privately supply an operator username and password of12–128 characters.',
    );
  const salt = newSalt(),
    password = await derivePassword(input.data.password, salt);
  const pool = new pg.Pool({
    connectionString: target.url,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  let client: pg.PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const owner = await client.query(
      "SELECT 1 FROM pg_class t JOIN pg_roles r ON r.oid=t.relowner WHERE t.oid='named_operators'::regclass AND r.rolname=current_user",
    );
    if (!owner.rowCount)
      throw new ProvisionInputError(
        'Use the existing migration owner for explicit named administrator setup.',
      );
    await client.query(
      'SELECT id FROM named_operator_gate WHERE id=1 FOR UPDATE',
    );
    const count = await client.query(
      'SELECT count(*)::integer AS n FROM named_operators',
    );
    if (count.rows[0].n && !recover)
      throw new ProvisionInputError(
        'Named identities already exist. Use the admin UI, or explicitly request owner recovery with --recover.',
      );
    const old = await client.query(
      'SELECT id FROM named_operators WHERE username=$1 FOR UPDATE',
      [input.data.username],
    );
    if (!old.rows[0] && count.rows[0].n >= 50)
      throw new ProvisionInputError(
        'Named identity capacity reached. Explicit recovery must target an existing identity.',
      );
    let row;
    if (old.rows[0]) {
      row = await client.query(
        "UPDATE named_operators SET password_hash=$2,password_salt=$3,role='admin',enabled=true,version=version+1 WHERE id=$1 RETURNING *",
        [old.rows[0].id, password, salt],
      );
    } else
      row = await client.query(
        "INSERT INTO named_operators(id,username,password_hash,password_salt,role) VALUES($1,$2,$3,$4,'admin') RETURNING *",
        [randomUUID(), input.data.username, password, salt],
      );
    const identity = operatorIdentity(row.rows[0]);
    await client.query(
      'INSERT INTO named_operator_changes(operator_id,actor_id,payload) VALUES($1,NULL,$2)',
      [
        identity.id,
        {
          action: recover ? 'owner-recovery' : 'owner-initial-provision',
          identity,
        },
      ],
    );
    await client.query('COMMIT');
    return { username: identity.username, version: identity.version };
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    if (error instanceof ProvisionInputError) throw error;
    throw Error(
      'Named administrator setup rolled back. Check migration038, owner authority, explicit recovery choice and private input locally; no credentials are shown.',
      { cause: error },
    );
  } finally {
    client?.release();
    await pool.end();
  }
}

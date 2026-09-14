import { createRequire } from 'node:module';
import type { FeedbackSandbox } from './feedback-fixture';
import type { OwnedPool } from './retention';
import type { RuntimeRolePlan } from '../../../apps/api/src/database-roles';

export async function ownedRoleConnections(sandbox: FeedbackSandbox) {
  if (
    !sandbox.runtimeDatabaseUrl ||
    !sandbox.runtimeRole ||
    !/^f360_app_[a-f0-9]{32}$/.test(sandbox.runtimeRole)
  )
    throw Error(
      'This case requires the actual owned least-privilege API fixture.',
    );
  const runtimeUrl = new URL(sandbox.runtimeDatabaseUrl),
    ownerUrl = new URL(sandbox.databaseUrl);
  if (
    !/^e2e_feedback_[a-f0-9]{32}$/.test(sandbox.schema) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(ownerUrl.hostname) ||
    ownerUrl.searchParams.get('options') !==
      `-c search_path=${sandbox.schema}` ||
    runtimeUrl.searchParams.get('options') !==
      `-c search_path=${sandbox.schema}` ||
    runtimeUrl.host !== ownerUrl.host ||
    runtimeUrl.pathname !== ownerUrl.pathname ||
    runtimeUrl.username !== sandbox.runtimeRole
  )
    throw Error(
      'Runtime connection does not name the exact owned schema/role.',
    );
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: {
      connectionString: string;
      max: number;
      connectionTimeoutMillis: number;
      statement_timeout: number;
    }) => OwnedPool;
  };
  const owner = new Pool({
    connectionString: ownerUrl.href,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  const runtime = new Pool({
    connectionString: runtimeUrl.href,
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  try {
    const ownerIdentity = await owner.query<{ isolated: boolean }>(
      'SELECT current_schema()=$1 AND current_user<>$2 AS isolated',
      [sandbox.schema, sandbox.runtimeRole],
    );
    if (!ownerIdentity.rows[0]?.isolated)
      throw Error('Owned migration identity check failed.');
    const result = await runtime.query<{ isolated: boolean }>(
      'SELECT current_schema()=$1 AND current_user=$2 AS isolated',
      [sandbox.schema, sandbox.runtimeRole],
    );
    if (!result.rows[0]?.isolated)
      throw Error('Owned runtime identity check failed.');
    return {
      owner,
      runtime,
      role: sandbox.runtimeRole,
      runtimeUrl: sandbox.runtimeDatabaseUrl,
      close: async () => {
        await Promise.all([runtime.end(), owner.end()]);
      },
    };
  } catch {
    await Promise.all([runtime.end(), owner.end()]);
    throw Error(
      'Could not connect the owned runtime role. Check local provisioning; credentials are not included.',
    );
  }
}
interface DatabaseRoleTools {
  provisionRuntimeRole(
    ownerUrl: string,
    runtimeUrl: string,
    apply?: boolean,
  ): Promise<RuntimeRolePlan>;
  refreshRuntimeGrants(
    client: OwnedPool,
    env: NodeJS.ProcessEnv,
  ): Promise<void>;
}
export async function databaseRoleTools(): Promise<DatabaseRoleTools> {
  // Lazy compiled imports: no setup, credentials or database access at discovery.
  return import(
    new URL('../../../apps/api/dist/database-roles.js', import.meta.url).href
  );
}

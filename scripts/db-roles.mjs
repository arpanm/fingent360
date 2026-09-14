import { provisionRuntimeRole } from '../apps/api/dist/database-roles.js';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1)
    throw Error(
      'Usage: pnpm db:roles [--apply]. Preview is read-only; apply is explicit.',
    );
  if (!process.env.MIGRATION_DATABASE_URL || !process.env.DATABASE_URL)
    throw Error(
      'Privately configure explicit MIGRATION_DATABASE_URL and distinct runtime DATABASE_URL first. No configuration file is changed by this command.',
    );
  const plan = await provisionRuntimeRole(
    process.env.MIGRATION_DATABASE_URL,
    process.env.DATABASE_URL,
    args.includes('--apply'),
  );
  console.log(
    `${plan.applied ? 'Applied' : 'Preview'}: ${plan.action} runtime role ${plan.role} for schema ${plan.schema}. Runtime table DML and sequence USAGE; no persistent schema CREATE, ownership or role/database administration.`,
  );
  console.log(
    `Database-wide temporary tables: ${plan.temporaryTables ? 'allowed by existing grants' : 'not allowed'}. PUBLIC grants were not changed.`,
  );
  console.log(
    plan.applied
      ? 'Restart the API with its runtime URL. Existing role passwords and application data were preserved.'
      : 'No privileges changed. Review the plan, then explicitly run pnpm db:roles --apply.',
  );
} catch (error) {
  // The imported provisioner exposes only safe errors, never raw driver details.
  console.error(
    error instanceof Error
      ? error.message
      : 'Role setup unavailable. Check the local configuration.',
  );
  process.exitCode = 1;
}

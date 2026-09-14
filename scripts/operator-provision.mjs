import {
  provisionNamedAdministrator,
  ProvisionInputError,
} from '../apps/api/dist/provision-operator.js';
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--recover') || args.length > 1)
    throw Error(
      'Usage: pnpm ops:provision [--recover]. This is an explicit local owner action.',
    );
  const owner = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (
    !owner ||
    !process.env.OPERATOR_USERNAME ||
    !process.env.OPERATOR_PASSWORD
  )
    throw Error(
      'Privately configure the owner URL and temporary OPERATOR_USERNAME/OPERATOR_PASSWORD environment values. Nothing is generated or printed.',
    );
  const result = await provisionNamedAdministrator(
    owner,
    {
      username: process.env.OPERATOR_USERNAME,
      password: process.env.OPERATOR_PASSWORD,
    },
    args.includes('--recover'),
  );
  console.log(
    `Named administrator provisioned at revision ${result.version}. Clear temporary credential variables, explicitly set OPS_AUTH_MODE=named and restart the API when ready.`,
  );
} catch (error) {
  console.error(
    error instanceof ProvisionInputError
      ? error.message
      : 'Named provisioning unavailable. Check private input, owner/migration038 and explicit --recover choice locally. No driver details or credentials are printed.',
  );
  process.exitCode = 1;
}

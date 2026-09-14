/** Runtime children do not inherit migration/Compose owner credentials. */
export function runtimeEnvironment(env) {
  const runtime = { ...env };
  delete runtime.MIGRATION_DATABASE_URL;
  delete runtime.OPERATOR_USERNAME;
  delete runtime.OPERATOR_PASSWORD;
  delete runtime.POSTGRES_USER;
  delete runtime.POSTGRES_PASSWORD;
  return runtime;
}

/** Runtime children do not inherit migration/Compose owner credentials. */
export function runtimeEnvironment(env) {
  const runtime = { ...env };
  delete runtime.MIGRATION_DATABASE_URL;
  delete runtime.POSTGRES_USER;
  delete runtime.POSTGRES_PASSWORD;
  return runtime;
}

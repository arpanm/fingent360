// Never expose driver messages, SQL, connection strings or parameter values.
export function storageErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code : undefined;
  switch (code) {
    case '42P01':
    case '42703':
      return 'Workspace schema is missing or incompatible. Run pnpm db:migrate against the same DATABASE_URL used by the API, then retry.';
    case '28P01':
    case '28000':
      return 'PostgreSQL authentication failed. Check the API database credentials locally; do not share them.';
    case '42501':
      return 'PostgreSQL denied access. The configured database role needs access to the virtual workspace tables.';
    case '3D000':
      return 'The configured PostgreSQL database does not exist. Check DATABASE_URL locally.';
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'EHOSTUNREACH':
    case 'ETIMEDOUT':
    case '57P01':
    case '57P03':
    case '08006':
      return 'PostgreSQL is unreachable or unavailable. Start the configured database and check its host and port locally.';
    case '57014':
      return 'The database operation timed out. Retry after checking database availability and locks.';
    case 'ENOENT':
      return 'The migration SQL file could not be found. Restore infra/migrations/001_virtual_journey.sql and rebuild the API.';
    default:
      return 'Workspace storage operation failed. Confirm the database is reachable and pnpm db:migrate succeeded for the API database. The cause has not been identified.';
  }
}

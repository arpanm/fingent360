export type ReadingPhase =
  | 'connection'
  | 'begin'
  | 'admission'
  | 'edition'
  | 'capture'
  | 'work'
  | 'commit';

/** Never pass raw exception strings, SQL or parameters to public responses/logs. */
export function readingFailure(
  error: unknown,
  incident: string,
  phase: ReadingPhase,
) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const sqlState =
    typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null;
  const category =
    sqlState === '42P01' || sqlState === '42703'
      ? 'schema'
      : sqlState === '42501'
        ? 'permissions'
        : sqlState?.startsWith('23')
          ? 'integrity'
          : sqlState?.startsWith('08') || sqlState === '57P01'
            ? 'connection'
            : sqlState === '57014' || sqlState === '55P03'
              ? 'timeout'
              : 'unexpected';
  return {
    event: 'reading-transaction-failed',
    incident,
    phase,
    category,
    sqlState,
  };
}

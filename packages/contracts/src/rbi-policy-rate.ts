/** Exact directional repo-rate wording; facility rates and basis-point amounts are not repo levels. */
export function parseRbiRepoChange(quote: string) {
  const pattern =
    /policy repo rate\b[^.!?]{0,200}?\bfrom\s+(\d{1,2}(?:\.\d{1,2})?)\s+per cent\s+to\s+(\d{1,2}(?:\.\d{1,2})?)\s+per cent\b/gi;
  const matches = [...quote.matchAll(pattern)];
  if (matches.length !== 1)
    throw Error('Retain one explicit RBI policy repo rate from/to sentence.');
  const normalized = (value: string) =>
    value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return {
    prior: normalized(matches[0]![1]!),
    observed: normalized(matches[0]![2]!),
    policy: 'rbi-explicit-repo-from-to-v1' as const,
  };
}

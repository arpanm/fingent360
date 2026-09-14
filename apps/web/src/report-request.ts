export class ReportSignedOut extends Error {}
export async function reportRequest(
  path = '',
  body?: unknown,
  method = 'POST',
) {
  const response = await fetch(`/api/v1/account/reports${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (response.status === 401)
    throw new ReportSignedOut('Sign in to view your private record reports.');
  const data: unknown = await response.json();
  if (!response.ok)
    throw Error(
      typeof data === 'object' && data && 'message' in data
        ? String(data.message)
        : 'Unable to load reports. Try again.',
    );
  return data;
}

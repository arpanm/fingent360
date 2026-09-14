export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function json(
  path: string,
  body?: unknown,
  method = 'GET',
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    signal: signal ?? AbortSignal.timeout(20000),
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  // Authentication denial must not depend on an error body arriving or parsing.
  if (response.status === 401) {
    void response.body?.cancel().catch(() => {});
    throw new RequestError('Please sign in to continue.', 401);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      typeof data === 'object' && data && 'message' in data
        ? String(data.message)
        : 'This could not be completed. Please try again.',
      response.status,
    );
  if (data === null)
    throw new RequestError(
      'An unreadable response was received. Please try again.',
      502,
    );
  return data;
}

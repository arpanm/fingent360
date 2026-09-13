import {
  LibrarySchema,
  LibraryReminderSchema,
  LibraryPreferencesSchema,
  AccountActionSchema,
  type LibraryPreferences,
} from '@fingent360/contracts';
export class LibrarySignInRequired extends Error {}
export async function libraryRequest(
  path = '',
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/account/library${path}`, {
      method,
      credentials: 'same-origin',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      'Could not reach your library. Check your connection and try again.',
      { cause: error },
    );
  }
  if (response.status === 401)
    throw new LibrarySignInRequired('Sign in to save items and preferences.');
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      'The library returned an unreadable response. Please retry shortly.',
    );
  }
  if (!response.ok)
    throw new Error(
      typeof value === 'object' &&
        value &&
        'message' in value &&
        typeof value.message === 'string'
        ? value.message.slice(0, 300)
        : 'Your library is unavailable. Try again.',
    );
  return value;
}
export const fetchLibrary = async (signal?: AbortSignal) =>
  LibrarySchema.parse(await libraryRequest('', undefined, 'GET', signal));
export const saveLibraryItem = async (id: string, version?: number) =>
  AccountActionSchema.parse(
    await libraryRequest(
      `/items/${encodeURIComponent(id)}/save`,
      version === undefined ? {} : { version },
      'PUT',
    ),
  );
export const unsaveLibraryItem = async (id: string) =>
  AccountActionSchema.parse(
    await libraryRequest(
      `/items/${encodeURIComponent(id)}/save`,
      undefined,
      'DELETE',
    ),
  );
export const reactToLibraryItem = async (
  id: string,
  reaction: 'more' | 'less',
) =>
  AccountActionSchema.parse(
    await libraryRequest(
      `/items/${encodeURIComponent(id)}/reaction`,
      { reaction },
      'PUT',
    ),
  );
export const clearLibraryReaction = async (id: string) =>
  AccountActionSchema.parse(
    await libraryRequest(
      `/items/${encodeURIComponent(id)}/reaction`,
      undefined,
      'DELETE',
    ),
  );
export const saveReadingPosition = async (
  id: string,
  version: number,
  percent: number,
) =>
  AccountActionSchema.parse(
    await libraryRequest(
      `/items/${encodeURIComponent(id)}/position`,
      { version, percent },
      'PUT',
    ),
  );
export const saveLibraryPreferences = async (preferences: LibraryPreferences) =>
  LibraryPreferencesSchema.parse(
    await libraryRequest('/preferences', preferences, 'PUT'),
  );
export const resetLibraryPreferences = async () =>
  AccountActionSchema.parse(await libraryRequest('/preferences/reset', {}));
export const createLibraryReminder = async (input: {
  itemId: string;
  dueAt: string;
  timeZone: string;
  idempotencyKey: string;
}) => LibraryReminderSchema.parse(await libraryRequest('/reminders', input));

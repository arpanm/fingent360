import { currentPublications, publicLibrary } from '@fingent360/contracts';
import { z } from 'zod';
import {
  readLocalConsent,
  recordLocalConsentOptIn,
  requireLocalConsent,
} from './consents';
import { consentActive } from '@fingent360/contracts';
import {
  LibrarySchema,
  LibraryItemIdSchema,
  LibrarySaveInputSchema,
  LibraryReactionInputSchema,
  LibraryPositionInputSchema,
  LibraryPreferencesSchema,
  LibraryReminderInputSchema,
  LibraryReminderUpdateSchema,
  LibraryReminderCancelSchema,
  FeedRankingSchema,
  selectToday,
  type Library,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
import { published, filtered, page, filtersFor } from './content';
function localLibrary(state: LocalState, userId: string): Library {
  const all = (state.data.localLibraries ?? {}) as Record<string, Library>;
  return (
    all[userId] ??
    LibrarySchema.parse({
      saved: [],
      reactions: [],
      positions: [],
      preferences: { topics: [], mutedTopics: [], mode: 'chronological' },
      reminders: [],
      notifications: [],
    })
  );
}
export function exportOfflineLibrary(
  state: LocalState,
  userId: string,
  bundle: OfflineBundle,
): Library {
  return publicLibrary(
    localLibrary(state, userId),
    currentPublications(bundle.feed, bundle.histories),
  );
}
function future(dueAt: string) {
  const delta = Date.parse(dueAt) - Date.now();
  if (delta <= 0 || delta > 366 * 86400000)
    fail(400, 'Choose a future reminder within the next year.');
}
export function deliverOfflineReminders(
  state: LocalState,
  bundle: OfflineBundle,
) {
  const all = (state.data.localLibraries ?? {}) as Record<string, Library>;
  for (const [userId, lib] of Object.entries(all)) {
    if (!state.users[userId]) continue;
    for (const r of lib.reminders)
      if (r.status === 'pending' && Date.parse(r.dueAt) <= Date.now()) {
        const item = published(bundle).find((v) => v.id === r.itemId);
        r.status = item ? 'delivered' : 'cancelled';
        r.version++;
        if (item && !lib.notifications.some((n) => n.reminderId === r.id))
          lib.notifications.push({
            id: crypto.randomUUID(),
            reminderId: r.id,
            itemId: r.itemId,
            title: item.title,
            currentStatus: 'published',
            deliveredAt: new Date().toISOString(),
            readAt: null,
          });
      }
  }
}
export async function handleLibrary(
  req: OfflineRequest,
  state: LocalState,
  bundle: OfflineBundle,
): Promise<OfflineResult | undefined> {
  const p = req.path.replace(/^\/api\/v1\/account\/library/, '');
  if (!req.path.startsWith('/api/v1/account/library')) return undefined;
  const user = requireUser(state);
  const lib = localLibrary(state, user.id);
  const sources = currentPublications(bundle.feed, bundle.histories);
  const projectedReminder = (r: Library['reminders'][number]) =>
    publicLibrary({ ...lib, reminders: [r] }, sources).reminders[0]!;
  state.data.localLibraries ??= {} as Record<string, Library>;
  (state.data.localLibraries as Record<string, Library>)[user.id] = lib;
  deliverOfflineReminders(state, bundle);
  const now = () => new Date().toISOString();
  const current = (id: string, version?: number) => {
    const item = published(bundle).find((v) => v.id === id);
    if (!item) fail(404, 'Published item is not in this snapshot.');
    if (version && version !== item.version)
      fail(409, 'Source edition changed. Reopen the item.');
    return item;
  };
  if (req.method === 'GET' && p === '')
    return { body: publicLibrary(lib, sources) };
  if (req.method === 'GET' && p === '/feed') {
    const score = (item: ReturnType<typeof published>[number]) =>
      lib.preferences.topics.filter((t) => item.topics.includes(t)).length * 3 +
      lib.reactions.reduce((n, r) => {
        const ref = sources.find(
          (v) => v.id === r.itemId && v.status === 'published',
        );
        return (
          n +
          (r.itemId === item.id
            ? 8
            : ref?.topics.some((t) => item.topics.includes(t))
              ? 2
              : 0) *
            (r.reaction === 'more' ? 1 : -1)
        );
      }, 0) +
      (lib.saved.some((s) => s.itemId === item.id) ? 1 : 0);
    const consent = readLocalConsent(state, user.id, 'reading-personalization');
    const chronological =
      lib.preferences.mode === 'chronological' ||
      !consentActive(consent, now());
    const candidates = filtered(req, published(bundle))
      .filter(
        (v) => !v.topics.some((t) => lib.preferences.mutedTopics.includes(t)),
      )
      .sort(
        (a, b) =>
          (chronological ? 0 : score(b) - score(a)) ||
          b.publishedAt.localeCompare(a.publishedAt) ||
          a.id.localeCompare(b.id),
      );
    if (!chronological)
      for (let i = 2; i < candidates.length; i++)
        if (
          candidates[i]!.source.name === candidates[i - 1]!.source.name &&
          candidates[i]!.source.name === candidates[i - 2]!.source.name
        ) {
          const j = candidates.findIndex(
            (v, k) => k > i && v.source.name !== candidates[i]!.source.name,
          );
          if (j >= 0) candidates.splice(i, 0, candidates.splice(j, 1)[0]!);
        }
    const selected = await page(
      req,
      filtersFor(req).view === 'today' ? selectToday(candidates) : candidates,
      [
        bundle.generatedAt,
        user.id,
        consent.version,
        chronological,
        lib.preferences,
        lib.reactions,
        lib.saved.map((v) => [v.itemId, v.version]),
      ],
    );
    requireUser(state);
    if (!chronological)
      requireLocalConsent(state, user.id, 'reading-personalization');
    return {
      body: FeedRankingSchema.parse({
        ...selected,
        evaluatedAt: bundle.generatedAt,
        policyVersion: 'explicit-v1',
        whyShown: Object.fromEntries(
          selected.items.map((v) => [
            v.id,
            chronological
              ? lib.preferences.mode === 'for_you'
                ? 'Dated snapshot, newest first. Personalization consent is inactive; review Purpose consent in Privacy.'
                : 'Dated offline snapshot, newest first.'
              : 'Your explicit topics and reading preferences; dated offline snapshot.',
          ]),
        ),
      }),
    };
  }
  const itemRoute = p.match(/^\/items\/([^/]+)\/(save|reaction|position)$/);
  if (itemRoute) {
    const id = LibraryItemIdSchema.parse(decodeURIComponent(itemRoute[1]!));
    const action = itemRoute[2];
    if (req.method === 'DELETE' && action === 'save') {
      lib.saved = lib.saved.filter((v) => v.itemId !== id);
      return { body: { ok: true } };
    }
    if (req.method === 'DELETE' && action === 'reaction') {
      lib.reactions = lib.reactions.filter((v) => v.itemId !== id);
      return { body: { ok: true } };
    }
    if (req.method === 'PUT' && action === 'save') {
      const input = LibrarySaveInputSchema.parse(req.body);
      const item = current(id, input.version);
      if (!lib.saved.some((v) => v.itemId === id))
        lib.saved.unshift({
          itemId: id,
          version: item.version,
          title: item.title,
          summary: item.summary,
          sourceUrl: item.source.url,
          savedAt: now(),
          currentStatus: item.status,
          currentVersion: item.version,
        });
      return { body: { ok: true } };
    }
    if (req.method === 'PUT' && action === 'reaction') {
      const input = LibraryReactionInputSchema.parse(req.body);
      current(id);
      lib.reactions = lib.reactions.filter((v) => v.itemId !== id);
      lib.reactions.push({ itemId: id, ...input });
      return { body: { ok: true } };
    }
    if (req.method === 'PUT' && action === 'position') {
      const input = LibraryPositionInputSchema.parse(req.body);
      current(id, input.version);
      lib.positions = lib.positions.filter((v) => v.itemId !== id);
      lib.positions.push({ itemId: id, ...input, updatedAt: now() });
      return { body: { ok: true } };
    }
  }
  if (req.method === 'PUT' && p === '/preferences') {
    const preferences = LibraryPreferencesSchema.parse(req.body);
    if (preferences.mode === 'for_you')
      recordLocalConsentOptIn(state, user.id, 'reading-personalization', {
        kind: 'reading-preference-opt-in',
        recordedAt: now(),
      });
    lib.preferences = preferences;
    if (preferences.mode === 'for_you')
      requireLocalConsent(state, user.id, 'reading-personalization');
    return { body: lib.preferences };
  }
  if (req.method === 'POST' && p === '/preferences/reset') {
    z.strictObject({}).parse(req.body);
    lib.preferences = { topics: [], mutedTopics: [], mode: 'chronological' };
    lib.reactions = [];
    lib.positions = [];
    return { body: { ok: true } };
  }
  if (req.method === 'POST' && p === '/reminders') {
    const input = LibraryReminderInputSchema.parse(req.body);
    const maps = (state.data.localLibraryRequests ??= {}) as Record<
      string,
      Record<string, { input: unknown; reminderId: string }>
    >;
    const requests = (maps[user.id] ??= {});
    const previous = requests[input.idempotencyKey];
    if (previous) {
      if (JSON.stringify(previous.input) !== JSON.stringify(input))
        fail(409, 'Reminder request key was already used.');
      return {
        body: projectedReminder(
          lib.reminders.find((v) => v.id === previous.reminderId)!,
        ),
      };
    }
    future(input.dueAt);
    const item = current(input.itemId);
    const reminder = {
      id: crypto.randomUUID(),
      itemId: item.id,
      title: item.title,
      dueAt: input.dueAt,
      timeZone: input.timeZone,
      status: 'pending' as const,
      currentStatus: 'published' as const,
      version: 1,
    };
    lib.reminders.push(reminder);
    requests[input.idempotencyKey] = { input, reminderId: reminder.id };
    return { body: projectedReminder(reminder), status: 201 };
  }
  const reminderRoute = p.match(/^\/reminders\/([^/]+)$/);
  if (reminderRoute && (req.method === 'PATCH' || req.method === 'DELETE')) {
    z.uuid().parse(reminderRoute[1]);
    const input =
      req.method === 'PATCH'
        ? LibraryReminderUpdateSchema.parse(req.body)
        : LibraryReminderCancelSchema.parse(req.body);
    const r = lib.reminders.find((v) => v.id === reminderRoute[1]);
    if (!r || r.version !== input.expectedVersion || r.status !== 'pending')
      fail(409, 'Reminder changed or is unavailable. Refresh and retry.');
    if (req.method === 'PATCH') {
      const update = LibraryReminderUpdateSchema.parse(req.body);
      future(update.dueAt);
      r.dueAt = update.dueAt;
      r.timeZone = update.timeZone;
    } else r.status = 'cancelled';
    r.version++;
    return { body: projectedReminder(r) };
  }
  const read = p.match(/^\/notifications\/([^/]+)\/read$/);
  if (read && req.method === 'PUT') {
    z.strictObject({}).parse(req.body);
    z.uuid().parse(read[1]);
    const n = lib.notifications.find((v) => v.id === read[1]);
    if (!n) fail(404, 'Notification not found.');
    n.readAt ??= now();
    return { body: { ok: true } };
  }
  return undefined;
}

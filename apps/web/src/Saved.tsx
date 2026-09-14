import { useEffect, useRef, useState } from 'react';
import {
  AccountActionSchema,
  FeedSchema,
  LibraryReminderSchema,
  type Library,
  type LibraryReminder,
  type LibraryPreferences,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
import {
  createLibraryReminder,
  fetchLibrary,
  libraryRequest,
  LibrarySignInRequired,
  resetLibraryPreferences,
  saveLibraryPreferences,
  unsaveLibraryItem,
} from './library-client';
function presetDate(preset: 'evening' | 'tomorrow') {
  const date = new Date();
  if (preset === 'tomorrow') date.setDate(date.getDate() + 1);
  date.setHours(preset === 'evening' ? 19 : 9, 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return localDate(date.toISOString());
}
function localDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function Saved() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reminderFilter, setReminderFilter] = useState('all');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<'saved' | 'reminders' | 'preferences'>(
    'saved',
  );
  const [topics, setTopics] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<LibraryPreferences>({
    topics: [],
    mutedTopics: [],
    mode: 'chronological',
  });
  const [itemId, setItemId] = useState('');
  const [when, setWhen] = useState('');
  const [editing, setEditing] = useState<LibraryReminder | null>(null);
  const signedOutRef = useRef(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const initialized = useRef(false);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  async function load(
    active: () => boolean = () => true,
    resetPreferences = false,
    signal?: AbortSignal,
  ) {
    const sequence = ++generation.current;
    const result = await fetchLibrary(signal);
    if (!active() || sequence !== generation.current) return;
    setLibrary(result);
    if (resetPreferences || !initialized.current) {
      setPreferences(result.preferences);
      initialized.current = true;
    }
    setSignedOut(false);
    signedOutRef.current = false;
  }
  function failure(error: unknown) {
    if (error instanceof LibrarySignInRequired) {
      signedOutRef.current = true;
      setSignedOut(true);
      setLibrary(null);
    } else
      setError(
        error instanceof Error
          ? error.message
          : 'Your saved items could not be loaded.',
      );
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let controller: AbortController | undefined;
    const refresh = () => {
      if (
        !active ||
        document.hidden ||
        signedOutRef.current ||
        busyRef.current ||
        controller
      )
        return;
      controller = new AbortController();
      const running = controller;
      const expected = generation.current + 1;
      void load(() => active && !document.hidden, false, running.signal)
        .catch((error) => {
          if (
            active &&
            !running.signal.aborted &&
            generation.current === expected
          )
            failure(error);
        })
        .finally(() => {
          if (controller === running) controller = undefined;
        });
    };
    const visibility = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (document.hidden) {
        controller?.abort();
        controller = undefined;
        return;
      }
      refresh();
      timer = setInterval(refresh, 15000);
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    void fetch('/api/v1/discovery/feed', { signal: AbortSignal.timeout(15000) })
      .then(async (response) => {
        if (!response.ok) return;
        const feed = FeedSchema.parse(await response.json());
        if (active)
          setTopics([...new Set(feed.items.flatMap((item) => item.topics))]);
      })
      .catch(() => {});
    return () => {
      active = false;
      controller?.abort();
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (error) {
      failure(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function schedule(dueAt: string, selectedItem: string) {
    const signature = JSON.stringify({ itemId: selectedItem, dueAt, timeZone });
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    await createLibraryReminder({
      itemId: selectedItem,
      dueAt,
      timeZone,
      idempotencyKey: pending.current.key,
    });
    pending.current = null;
  }
  const savedMatches =
    library?.saved.filter((value) => {
      const finished =
        library.positions.find(
          (position) =>
            position.itemId === value.itemId &&
            position.version === value.version,
        )?.percent === 100;
      return (
        (filter === 'all' || (filter === 'read') === finished) &&
        (statusFilter === 'all' ||
          (statusFilter === 'available') ===
            (value.currentStatus === 'published')) &&
        (!search.trim() ||
          `${value.title} ${value.summary}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()))
      );
    }) ?? [];
  if (signedOut)
    return (
      <section>
        <header className="page-header">
          <h1>Saved for you</h1>
        </header>
        <AccountGate
          next="saved"
          title="Keep something useful for later"
          description="Sign in to save your reading, choose topics and set private in-app reminders."
        />
      </section>
    );
  return (
    <section aria-labelledby="saved-title">
      <header className="page-header">
        <div>
          <p className="page-kicker">YOUR LIBRARY</p>
          <h1 id="saved-title">A little clarity, kept close.</h1>
          <p className="page-description">
            Return to ideas you saved. Read at your pace.
          </p>
          <a href="#reading-follow">Reading updates</a>
        </div>
        <a href="#today" className="button secondary">
          Find something to read
        </a>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void action(() => load())}
        >
          Refresh library
        </button>
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
          <button disabled={busy} onClick={() => void action(() => load())}>
            Reload library
          </button>
        </div>
      )}
      <p role="status">{busy ? 'Working…' : message}</p>
      {!library && !error && <p>Loading your library…</p>}
      {library && (
        <>
          <div
            className="segmented-control"
            role="group"
            aria-label="Library sections"
          >
            {(['saved', 'reminders', 'preferences'] as const).map((value) => (
              <button
                key={value}
                disabled={busy}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === 'saved'
                  ? 'Saved items'
                  : value === 'reminders'
                    ? 'Reminders'
                    : 'Reading preferences'}
              </button>
            ))}
          </div>
          {library.notifications.some((value) => !value.readAt) && (
            <section className="panel" aria-label="Reading reminders">
              <h2>Ready when you are</h2>
              {library.notifications
                .filter((value) => !value.readAt)
                .map((value) => (
                  <article className="card" key={value.id}>
                    <h3>{value.title}</h3>
                    <p>
                      Your reminder from{' '}
                      {new Date(value.deliveredAt).toLocaleString()}.
                    </p>
                    <a href={`#read/${encodeURIComponent(value.itemId)}`}>
                      {value.currentStatus === 'published'
                        ? 'Open reminder item'
                        : 'View source status'}
                    </a>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          AccountActionSchema.parse(
                            await libraryRequest(
                              `/notifications/${value.id}/read`,
                              {},
                              'PUT',
                            ),
                          );
                          await load();
                          setMessage('Reminder marked read.');
                        })
                      }
                    >
                      Mark reminder read
                    </button>
                  </article>
                ))}
            </section>
          )}
          {tab === 'saved' && (
            <section aria-label="Saved reading">
              <div className="section-heading">
                <h2>Your saved items</h2>
                <label>
                  Search saved items
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label>
                  Availability
                  <select
                    aria-label="Availability"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="available">Published</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>
                <label>
                  Show
                  <select
                    aria-label="Show"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="all">All saved</option>
                    <option value="unread">Not finished</option>
                    <option value="read">Finished reading</option>
                  </select>
                </label>
              </div>
              {library.saved.length === 0 && (
                <div className="empty-state">
                  <h3>Something worth returning to?</h3>
                  <p>
                    Save an article or term while reading and it will stay here.
                  </p>
                  <a href="#explore">Explore topics</a>
                </div>
              )}
              {library.saved.length > 0 && savedMatches.length === 0 && (
                <p>No saved items match these filters.</p>
              )}
              {savedMatches.map((value) => (
                <article className="card" key={value.itemId}>
                  <h3>{value.title}</h3>
                  <p>{value.summary}</p>
                  <p className="muted">
                    Saved {new Date(value.savedAt).toLocaleDateString()} ·
                    version {value.version}
                  </p>
                  {value.currentVersion !== null &&
                    value.currentVersion !== value.version && (
                      <p>
                        An updated version is available. Your saved summary
                        stays at version {value.version}; Continue reading opens
                        the latest version.
                      </p>
                    )}
                  {value.currentStatus !== 'published' && (
                    <p>
                      This item is no longer published. Source text is
                      unavailable; your saved edition and reading records
                      remain.
                    </p>
                  )}
                  <div className="page-actions">
                    <a
                      href={`#read/${encodeURIComponent(value.itemId)}?resume=1`}
                    >
                      {value.currentStatus === 'published'
                        ? 'Continue reading'
                        : 'View source status'}
                    </a>
                    <button
                      disabled={busy || value.currentStatus !== 'published'}
                      onClick={() => {
                        setItemId(value.itemId);
                        setWhen('');
                        setEditing(null);
                        setTab('reminders');
                      }}
                    >
                      Remind me
                    </button>
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() =>
                        void action(async () => {
                          await unsaveLibraryItem(value.itemId);
                          await load();
                          setMessage(
                            'Item removed from saved. Existing reminders can be cancelled in Reminders.',
                          );
                        })
                      }
                    >
                      Remove saved item
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
          {tab === 'reminders' && (
            <section className="panel" aria-label="Reminder settings">
              <h2>{editing ? 'Edit your reminder' : 'Make time to return'}</h2>
              <p>
                Reminders appear here when due. They do not send email or device
                notifications. Times below use {timeZone}. There are no quiet
                hours; choose a time that suits you.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(async () => {
                    const date = new Date(when);
                    if (
                      !when ||
                      !Number.isFinite(date.getTime()) ||
                      localDate(date.toISOString()) !== when
                    )
                      throw new Error('Choose a valid local date and time.');
                    const dueAt = date.toISOString();
                    if (editing)
                      LibraryReminderSchema.parse(
                        await libraryRequest(
                          `/reminders/${editing.id}`,
                          { expectedVersion: editing.version, dueAt, timeZone },
                          'PATCH',
                        ),
                      );
                    else await schedule(dueAt, itemId);
                    await load();
                    setWhen('');
                    setEditing(null);
                    setMessage('Reminder scheduled.');
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <legend>Choose your reading time</legend>
                  <div className="page-actions">
                    <button
                      type="button"
                      onClick={() => setWhen(presetDate('evening'))}
                    >
                      Next evening at 7 pm
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhen(presetDate('tomorrow'))}
                    >
                      Tomorrow at 9 am
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Saved item
                      <select
                        aria-label="Saved item"
                        required
                        value={itemId}
                        disabled={!!editing}
                        onChange={(event) => setItemId(event.target.value)}
                      >
                        <option value="">Choose an item</option>
                        {library.saved.map((value) => (
                          <option key={value.itemId} value={value.itemId}>
                            {value.title}
                          </option>
                        ))}
                        {editing &&
                          !library.saved.some(
                            (value) => value.itemId === editing.itemId,
                          ) && (
                            <option value={editing.itemId}>
                              {editing.title}
                            </option>
                          )}
                      </select>
                    </label>
                    <label>
                      Remind me on
                      <input
                        required
                        type="datetime-local"
                        value={when}
                        onChange={(event) => setWhen(event.target.value)}
                      />
                    </label>
                  </div>
                  <button type="submit">
                    {editing ? 'Save reminder changes' : 'Confirm reminder'}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setWhen('');
                      }}
                    >
                      Cancel editing
                    </button>
                  )}
                </fieldset>
              </form>
              <h3>Your reminders</h3>
              <label>
                Reminder status
                <select
                  aria-label="Reminder status"
                  value={reminderFilter}
                  onChange={(event) => setReminderFilter(event.target.value)}
                >
                  <option value="all">All reminders</option>
                  <option value="pending">Scheduled</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              {library.reminders.length === 0 && (
                <p>No reminders scheduled yet.</p>
              )}
              {library.reminders
                .filter(
                  (value) =>
                    reminderFilter === 'all' || value.status === reminderFilter,
                )
                .map((value) => (
                  <article className="card" key={value.id}>
                    <h4>{value.title}</h4>
                    <p>
                      {new Date(value.dueAt).toLocaleString()} · {value.status}
                    </p>
                    {value.status === 'delivered' &&
                      value.currentStatus === 'published' && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await schedule(
                                new Date(presetDate('tomorrow')).toISOString(),
                                value.itemId,
                              );
                              await load();
                              setMessage(
                                'New reminder scheduled for tomorrow. The original reminder stays in your history.',
                              );
                            })
                          }
                        >
                          Snooze until tomorrow
                        </button>
                      )}
                    {value.status === 'pending' && (
                      <div className="page-actions">
                        <button
                          disabled={busy || value.currentStatus !== 'published'}
                          onClick={() => {
                            setEditing(value);
                            setItemId(value.itemId);
                            setWhen(localDate(value.dueAt));
                          }}
                        >
                          Edit reminder
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              LibraryReminderSchema.parse(
                                await libraryRequest(
                                  `/reminders/${value.id}`,
                                  { expectedVersion: value.version },
                                  'DELETE',
                                ),
                              );
                              await load();
                              if (editing?.id === value.id) setEditing(null);
                              setMessage('Reminder cancelled.');
                            })
                          }
                        >
                          Cancel reminder
                        </button>
                      </div>
                    )}
                  </article>
                ))}
            </section>
          )}
          {tab === 'preferences' && (
            <section className="panel">
              <h2>Make your feed feel useful</h2>
              <p>
                Only your chosen topics, reactions and saved items affect your
                feed. Reading position helps you resume; it does not affect
                ranking. No dwell tracking is collected.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(async () => {
                    await saveLibraryPreferences(preferences);
                    await load();
                    setMessage('Reading preferences saved.');
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <legend>Your reading preferences</legend>
                  <label>
                    Feed order
                    <select
                      aria-label="Feed order"
                      value={preferences.mode}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          mode: event.target
                            .value as LibraryPreferences['mode'],
                        })
                      }
                    >
                      <option value="chronological">Newest first</option>
                      <option value="for_you">For you</option>
                    </select>
                  </label>
                  {[
                    ...new Set([
                      ...topics,
                      ...preferences.topics,
                      ...preferences.mutedTopics,
                    ]),
                  ].map((topic) => (
                    <label key={topic}>
                      {topic}
                      <select
                        aria-label={`Preference for ${topic}`}
                        value={
                          preferences.topics.includes(topic)
                            ? 'follow'
                            : preferences.mutedTopics.includes(topic)
                              ? 'mute'
                              : 'neutral'
                        }
                        onChange={(event) =>
                          setPreferences({
                            ...preferences,
                            topics: [
                              ...preferences.topics.filter(
                                (value) => value !== topic,
                              ),
                              ...(event.target.value === 'follow'
                                ? [topic]
                                : []),
                            ],
                            mutedTopics: [
                              ...preferences.mutedTopics.filter(
                                (value) => value !== topic,
                              ),
                              ...(event.target.value === 'mute' ? [topic] : []),
                            ],
                          })
                        }
                      >
                        <option value="neutral">Neutral</option>
                        <option value="follow">Follow</option>
                        <option value="mute">Mute</option>
                      </select>
                    </label>
                  ))}
                  <button>Save reading preferences</button>
                </fieldset>
              </form>
              <details>
                <summary>Reset your reading preferences</summary>
                <p>
                  Clears topic choices, reactions and reading positions. Saved
                  items and reminders stay.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await resetLibraryPreferences();
                      await load(() => true, true);
                      setMessage('Reading preferences reset.');
                    })
                  }
                >
                  Confirm reading reset
                </button>
              </details>
            </section>
          )}
        </>
      )}
    </section>
  );
}

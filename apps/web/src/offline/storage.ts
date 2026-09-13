import { fail, type LocalState } from './types';

// Schema 1 creates an empty, device-owned workspace. Future versions must migrate
// in onupgradeneeded and retain revisions; never reset a failing database.
const database = new Promise<IDBDatabase>((resolve, reject) => {
  const open = indexedDB.open('fingent360-device', 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains('workspace'))
      open.result.createObjectStore('workspace');
  };
  open.onsuccess = () => resolve(open.result);
  open.onerror = () =>
    reject(
      new Error(
        'Device storage could not open. Check available space. Your data was not reset.',
      ),
    );
  open.onblocked = () =>
    reject(
      new Error(
        'Close other Fingent360 windows and reopen to update device storage.',
      ),
    );
});
const empty = (): LocalState => ({
  schemaVersion: 1,
  revision: 0,
  users: {},
  sessionUserId: null,
  data: {},
});
async function read(): Promise<LocalState> {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db
      .transaction('workspace')
      .objectStore('workspace')
      .get('current');
    request.onsuccess = () => {
      const value = (request.result as LocalState | undefined) ?? empty();
      if (value.schemaVersion !== 1)
        reject(
          new Error(
            'This app cannot read this newer device workspace. Install the latest app; do not clear its data.',
          ),
        );
      else resolve(value);
    };
    request.onerror = () => reject(new Error('Device data could not be read.'));
  });
}
async function save(state: LocalState, revision: number) {
  const db = await database;
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    const store = tx.objectStore('workspace');
    const request = store.get('current');
    let conflict = false;
    request.onsuccess = () => {
      if (
        ((request.result as LocalState | undefined)?.revision ?? 0) !== revision
      ) {
        conflict = true;
        tx.abort();
        return;
      }
      state.revision = revision + 1;
      store.put(state, 'current');
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => {
      try {
        if (conflict)
          fail(409, 'Device data changed in another window. Reload and retry.');
        fail(
          503,
          'Device data could not be saved. Check free storage and retry.',
        );
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => {
      /* onabort reports the failed transaction once. */
    };
  });
}
let queue = Promise.resolve();
export function withState<T>(
  action: (state: LocalState) => Promise<T>,
): Promise<T> {
  const work = async () => {
    const state = await read();
    const revision = state.revision;
    const before = JSON.stringify(state);
    // Async WebCrypto completes outside a transaction. Save uses compare-and-swap
    // so a second WebView cannot silently overwrite a committed workspace.
    const result = await action(state);
    if (JSON.stringify(state) !== before) await save(state, revision);
    return result;
  };
  const result: Promise<T> = queue.then(async () => {
    if (navigator.locks)
      return await navigator.locks.request<Promise<T>>(
        'fingent360-device',
        work,
      );
    return await work();
  });
  queue = result.then(
    () => {},
    () => {},
  );
  return result;
}

import { STORE } from '../keys';

// The save slots' own storage (1 Nov, the player: "why is there maximum capacity for browser
// saves?"): IndexedDB, whose room is a share of the device's free space (Chromium up to 60% of the
// disk, Firefox a per-site group limit: MDN, "Storage quotas and eviction criteria"), where
// localStorage gives about 5 MiB to the whole of m1omg.github.io, shared by the main address,
// /next/ and the archived builds. Only the slots' data lives here; their index, small, stays in
// localStorage so the list is read at once (save.ts). Every call is guarded: IndexedDB can be
// missing or blocked (some private windows, the checks in Node), and the game must still run.

const DB = `${STORE.replace(/\.$/, '')}`;
const STORE_NAME = 'slots';

let opening: Promise<IDBDatabase | null> | null = null;

/** The database, opened once; null where there is none. */
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Run one request in a transaction; resolves its result, or `fail` on any error. */
async function run<T>(mode: IDBTransactionMode, make: (s: IDBObjectStore) => IDBRequest, fail: T): Promise<T> {
  const db = await open();
  if (!db) return fail;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const req = make(tx.objectStore(STORE_NAME));
      let value: T = fail;
      req.onsuccess = () => (value = req.result as T);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => resolve(fail);
      tx.onabort = () => resolve(fail);
    } catch {
      resolve(fail);
    }
  });
}

/** Whether this browser keeps slots in IndexedDB. */
export async function dbAvailable(): Promise<boolean> {
  return (await open()) !== null;
}

/** Keep a slot's data; true once it is written. */
export async function dbPut(id: string, data: string): Promise<boolean> {
  const r = await run<unknown>('readwrite', (s) => s.put(data, id), false);
  return r !== false;
}

/** A slot's data, or null. */
export async function dbGet(id: string): Promise<string | null> {
  const r = await run<unknown>('readonly', (s) => s.get(id), null);
  return typeof r === 'string' ? r : null;
}

/** Remove a slot's data; true once removed (or there was nothing). */
export async function dbDelete(id: string): Promise<boolean> {
  const r = await run<unknown>('readwrite', (s) => s.delete(id), false);
  return r !== false;
}

/** The ids of every slot kept here. */
export async function dbKeys(): Promise<string[]> {
  const r = await run<unknown>('readonly', (s) => s.getAllKeys(), []);
  return Array.isArray(r) ? r.map(String) : [];
}

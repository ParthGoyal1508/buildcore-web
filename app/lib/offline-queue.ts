/**
 * The offline punch queue (research.md §5, spec FR-009).
 *
 * Native IndexedDB, no wrapper library: this is one object store and three
 * operations, and a dependency for that would cost more than it saves.
 *
 * IndexedDB rather than localStorage because a queued punch carries its photo as a
 * `Blob`. localStorage stores strings only, so the photo would have to be
 * base64-encoded — inflating it by a third and forcing a synchronous main-thread
 * encode of a few hundred kilobytes on a cheap phone, at the exact moment the
 * worker is waiting to see whether their punch registered.
 */

const DB_NAME = 'buildcore-my-workspace';
const DB_VERSION = 2;
const STORE = 'punch-queue';
/**
 * Muster capture queue (feature 013 FR-006).
 *
 * A second object store in the **same** database and the **same** module — the labour
 * muster reuses this queue's mechanics (`openDb`, `promisify`, the `DrainResult`
 * shape, the capture-order replay) rather than growing a second queue implementation.
 * It is a separate store, not a shared one, only so the punch drain
 * (`drainQueue`) and the muster drain (`drainMusters`) never try to submit each
 * other's payloads; both are driven by the identical logic below.
 */
const MUSTER_STORE = 'muster-queue';

/** One punch captured with no connectivity, awaiting sync. */
export interface OfflineQueueEntry {
  /** Assigned by the store; present on entries read back, absent when enqueuing. */
  id?: number;
  type: 'in' | 'out';
  photo: Blob;
  latitude: number;
  longitude: number;
  /** ISO 8601, captured at the moment the worker punched — not at sync time. This
   * is the value that makes the whole queue worth having. */
  capturedAt: string;
}

/** One worker's marking within a queued muster; the photo is held as a Blob. */
export interface MusterQueueLine {
  workerId: string;
  attendanceType: string;
  overtimeHours?: number;
  photo: Blob;
}

/** A whole muster captured with no connectivity, awaiting sync (013 FR-011). */
export interface MusterQueueEntry {
  id?: number;
  siteId: string;
  date: string;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  /** ISO 8601 at capture time, not sync time. */
  capturedAt: string;
  lines: MusterQueueLine[];
}

/** Resolves null where IndexedDB is unavailable (SSR, or a browser with storage
 * disabled) so callers can degrade rather than crash. */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(MUSTER_STORE)) {
        db.createObjectStore(MUSTER_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // A queue that cannot be opened must not take the punch screen down with it —
    // the caller falls back to reporting the failure directly.
    request.onerror = () => resolve(null);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Stores a punch for later submission. */
export async function enqueue(entry: OfflineQueueEntry): Promise<void> {
  const db = await openDb();
  if (!db) throw new Error('Offline storage is unavailable on this device.');
  const tx = db.transaction(STORE, 'readwrite');
  // `id` is autoIncrement; passing an explicit undefined would set the key path to
  // undefined rather than letting the store assign one.
  const { id: _id, ...record } = entry;
  void _id;
  await promisify(tx.objectStore(STORE).add(record));
  db.close();
}

/** Every queued punch, oldest capture first. */
export async function listQueued(): Promise<OfflineQueueEntry[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(STORE, 'readonly');
  const rows = await promisify(
    tx.objectStore(STORE).getAll() as IDBRequest<OfflineQueueEntry[]>,
  );
  db.close();
  return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function getQueuedCount(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  const tx = db.transaction(STORE, 'readonly');
  const count = await promisify(tx.objectStore(STORE).count());
  db.close();
  return count;
}

export async function remove(id: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  await promisify(tx.objectStore(STORE).delete(id));
  db.close();
}

/** What happened to one entry during a drain. */
export interface DrainFailure {
  capturedAt: string;
  reason: string;
}

export interface DrainResult {
  synced: number;
  failures: DrainFailure[];
}

/**
 * Submits every queued punch in capture order.
 *
 * Order matters: the backend enforces one open punch-in at a time, so replaying an
 * out before its in would be rejected outright.
 *
 * The `submit` function is injected rather than imported so this module stays free
 * of the API layer — which also lets a caller drain against a stub.
 *
 * A rejected entry is removed, not retried forever. The rejections that actually
 * occur here are permanent — a capture older than the offline window, a period
 * since closed for payroll — and retrying them on every reconnect would mean a
 * queue that never empties and an error the worker sees every time they regain
 * signal. The failure is reported back to the caller so it can be shown once.
 */
export async function drainQueue(
  submit: (entry: OfflineQueueEntry) => Promise<unknown>,
): Promise<DrainResult> {
  const entries = await listQueued();
  const failures: DrainFailure[] = [];
  let synced = 0;

  for (const entry of entries) {
    try {
      await submit(entry);
      if (entry.id !== undefined) await remove(entry.id);
      synced += 1;
    } catch (error) {
      const isOffline =
        typeof navigator !== 'undefined' && navigator.onLine === false;
      // Connectivity dropped again mid-drain: stop, keep everything still queued,
      // and let the next `online` event pick up where this left off.
      if (isOffline) break;

      failures.push({
        capturedAt: entry.capturedAt,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      if (entry.id !== undefined) await remove(entry.id);
    }
  }

  return { synced, failures };
}

// ─────────────────────────────────────────────────────────────────────────────
// Muster queue (013 FR-006) — the same three operations against the muster store.
// ─────────────────────────────────────────────────────────────────────────────

/** Stores a whole muster for later submission. */
export async function enqueueMuster(entry: MusterQueueEntry): Promise<void> {
  const db = await openDb();
  if (!db) throw new Error('Offline storage is unavailable on this device.');
  const tx = db.transaction(MUSTER_STORE, 'readwrite');
  const { id: _id, ...record } = entry;
  void _id;
  await promisify(tx.objectStore(MUSTER_STORE).add(record));
  db.close();
}

/** Every queued muster, oldest capture first. */
export async function listQueuedMusters(): Promise<MusterQueueEntry[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(MUSTER_STORE, 'readonly');
  const rows = await promisify(
    tx.objectStore(MUSTER_STORE).getAll() as IDBRequest<MusterQueueEntry[]>,
  );
  db.close();
  return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function getQueuedMusterCount(): Promise<number> {
  const db = await openDb();
  if (!db) return 0;
  const tx = db.transaction(MUSTER_STORE, 'readonly');
  const count = await promisify(tx.objectStore(MUSTER_STORE).count());
  db.close();
  return count;
}

export async function removeMuster(id: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(MUSTER_STORE, 'readwrite');
  await promisify(tx.objectStore(MUSTER_STORE).delete(id));
  db.close();
}

/**
 * Submits every queued muster in capture order, mirroring `drainQueue` exactly: a
 * connectivity drop mid-drain stops and keeps everything queued; a permanent
 * rejection (a rate changed, a worker deactivated — spec's offline edge cases) is
 * reported once and removed rather than retried forever.
 */
export async function drainMusters(
  submit: (entry: MusterQueueEntry) => Promise<unknown>,
): Promise<DrainResult> {
  const entries = await listQueuedMusters();
  const failures: DrainFailure[] = [];
  let synced = 0;

  for (const entry of entries) {
    try {
      await submit(entry);
      if (entry.id !== undefined) await removeMuster(entry.id);
      synced += 1;
    } catch (error) {
      const isOffline =
        typeof navigator !== 'undefined' && navigator.onLine === false;
      if (isOffline) break;

      failures.push({
        capturedAt: entry.capturedAt,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      if (entry.id !== undefined) await removeMuster(entry.id);
    }
  }

  return { synced, failures };
}

/**
 * The offline capture queues.
 *
 * **The punch store is drain-only since 020 Phase 2 (2026-10-03).** Nothing enqueues a punch any
 * more: a queued punch cannot carry FR-013's refusal back to the worker at the moment they punched,
 * so they saw a success at 8am and learnt at 5pm that the day did not count. `enqueue` is gone;
 * `drainQueue` stays, because punches captured under the old promise are still sitting on devices
 * and discarding them would throw away days people actually worked. See `drainQueue` below.
 *
 * The muster store (013 FR-006) is **unaffected and still enqueues**. It was a separate object
 * store for exactly this reason. A muster is a supervisor recording other people's attendance in a
 * place that frequently has no signal, and nothing about it is refused at capture time — the two
 * acts look similar and are not.
 *
 * Original note (research.md §5, spec FR-009):
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
/**
 * 3 since feature 018: the bill-draft store was added (`app/lib/bill-drafts.ts`).
 *
 * **A bump is required for a new object store and for nothing else.** An object store holds no
 * column list, so a new *field* on an existing entry needs no bump — which is why
 * `accuracyMeters` arrived without one.
 *
 * **020 Phase 2 landed second (2026-10-03) and did not bump it** — T009a's coordination point,
 * resolved. Retiring the punch *writer* removes no object store: the store itself must stay, because
 * punches queued under the old promise are still on devices and `drainQueue` has to read them. A
 * version is a high-water mark and reverting it leaves browsers that already opened the database at
 * the higher version unable to open it at all, so neither feature touches the other's number.
 */
const DB_VERSION = 3;
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

/**
 * Bill drafts (018 FR-005), owned by `app/lib/bill-drafts.ts`.
 *
 * A third store in the same database, for the reason the muster store is a second one: the
 * mechanics here — `openDb`, `promisify`, the version ladder — are the thing worth sharing, and a
 * second IndexedDB implementation in the same app would be two upgrade paths to keep in step.
 *
 * **This store is never drained to the server**, and that is the one thing to know before touching
 * it. The punch and muster queues hold work that has not happened yet and must reach the API; a
 * bill draft holds what somebody had typed, to offer back when the sheet reopens. Wiring it into a
 * drain loop would submit half-finished bills.
 */
export const BILL_DRAFT_STORE = 'bill-drafts';

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
  /**
   * The accuracy the device reported **at capture time** (020 FR-014a).
   *
   * Stored for the same reason `capturedAt` is: the fix that matters is the one the
   * worker punched on, and a queued punch replayed without it would be judged on its
   * raw point — the exact unfairness this field exists to prevent, displaced by
   * however long the phone was offline.
   *
   * **Spelled `accuracyMeters`, unlike `MusterQueueEntry.accuracyMetres` below.**
   * Both spellings in one file is deliberate, not an oversight: each entry mirrors
   * the payload of the endpoint it drains to, and the punch and muster endpoints
   * genuinely differ. Unifying them would move the mismatch into the drain, which is
   * the one place a wrong key is silently accepted and ignored.
   *
   * Optional, and no `DB_VERSION` bump: an object store holds no column list, so
   * entries written before this field simply lack it and drain without one.
   */
  accuracyMeters?: number;
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
export function openDb(): Promise<IDBDatabase | null> {
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
      // Keyed by the sheet it belongs to, not auto-incremented: there is exactly one draft per
      // bill sheet, and the second save must replace the first rather than accumulate.
      if (!db.objectStoreNames.contains(BILL_DRAFT_STORE)) {
        db.createObjectStore(BILL_DRAFT_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // A queue that cannot be opened must not take the punch screen down with it —
    // the caller falls back to reporting the failure directly.
    request.onerror = () => resolve(null);
  });
}

export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/*
 * `enqueue` was here, and is deliberately gone (020 T008).
 *
 * Removed rather than left unused, so that re-introducing offline punching takes a decision and a
 * diff somebody reviews, instead of an import nobody noticed was still available. `enqueueMuster`
 * below is the one that remains, and it is a different act.
 */

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
 * Submits every punch still queued from before 020 Phase 2, in capture order.
 *
 * **A flush, not a queue drain.** Nothing writes to this store any more (T010): these entries were
 * captured under the old promise that an offline punch would sync, and the only option that does
 * not silently discard a worker's day is to honour that promise once and then let the store stay
 * empty. A device that never had a queued punch drains nothing and shows nothing.
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

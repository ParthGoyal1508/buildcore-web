import { BILL_DRAFT_STORE, openDb, promisify } from '@/app/lib/offline-queue';

/**
 * What this device keeps for the signed-in person, and the sweep when they leave (036 A26).
 *
 * Bill drafts (IndexedDB), the legacy punch queue and the labour screen's remembered site were
 * keyed by nothing and kept through a sign-out. On a shared site phone or office PC the next person
 * to sign in was offered the previous person's half-typed bill — and the punch queue, drained on
 * the next online moment, would have sent the previous person's punches under the new session.
 *
 * Two measures, because either alone leaves a gap:
 * - drafts are stored under the owner's user id (`ownedKey`), so even data that survives — a tab
 *   that died before signing out — is never offered to anyone else;
 * - `clearLocalUserData` empties it all on sign-out. When a refused renewal ends the session it
 *   keeps the bill drafts: they are already keyed to their owner, so nobody else is ever offered
 *   them, and wiping them would throw away a person's half-typed bill only because their session
 *   expired. Everything not keyed to a person (the legacy punch queue, the remembered site) still
 *   goes, since that is what could reach the next person.
 */

let owner: string | null = null;

/** Set from `getCurrentUser()` once the session's user is known. */
export function setLocalDataOwner(userId: string | null) {
  owner = userId;
}

/** `key` scoped to the signed-in user, or null while nobody is known (nothing is stored then). */
export function ownedKey(key: string): string | null {
  return owner ? `${owner}|${key}` : null;
}

/** localStorage keys that remember a person's choices. */
const LOCAL_STORAGE_KEYS = ['buildcore.labour.attendanceSite'];
/** IndexedDB stores holding a person's work. The punch queue is the legacy one `drainQueue` reads. */
const USER_STORES = [BILL_DRAFT_STORE, 'punch-queue'];

/**
 * Empties every per-person store on this device. Best effort: a sign-out never waits on, or fails
 * because of, storage. `keepOwnedDrafts` spares the user-keyed bill drafts (session expiry).
 */
export async function clearLocalUserData({
  keepOwnedDrafts = false,
}: { keepOwnedDrafts?: boolean } = {}): Promise<void> {
  owner = null;
  try {
    for (const key of LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage refused (private mode): nothing was stored either.
  }
  try {
    const db = await openDb();
    if (!db) return;
    const stores = USER_STORES.filter(
      (name) =>
        db.objectStoreNames.contains(name) &&
        !(keepOwnedDrafts && name === BILL_DRAFT_STORE),
    );
    if (stores.length > 0) {
      const tx = db.transaction(stores, 'readwrite');
      await Promise.all(stores.map((name) => promisify(tx.objectStore(name).clear())));
    }
    db.close();
  } catch {
    // As above.
  }
}

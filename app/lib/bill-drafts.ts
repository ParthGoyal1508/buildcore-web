import {
  BILL_DRAFT_STORE,
  openDb,
  promisify,
} from '@/app/lib/offline-queue';

/**
 * What somebody had typed into a bill sheet, kept on this device (018 FR-005, T019–T022).
 *
 * ## Draft recovery, not offline-first
 *
 * The decision of 2026-10-01. **Submitting still needs connectivity.** This store exists for one
 * failure: a biller is forty lines into a 300-line BOQ, the tab dies or the laptop sleeps, and an
 * hour of measurement is gone. It does not exist to let a bill be raised from a site with no signal
 * — that would need the server's BOQ rates, its cumulative quantities and its over-scope check, none
 * of which can be had offline, and a bill composed without them would be wrong in ways nobody could
 * see.
 *
 * ## This store is never drained
 *
 * The punch and muster queues in `offline-queue.ts` hold work that must reach the API, and a drain
 * loop pushes them. **This one must never be wired into one.** A draft is what somebody had typed,
 * not what they decided; draining it would submit half-finished bills on their behalf, which is
 * worse than losing the typing.
 *
 * ## A draft is offered, never applied
 *
 * `readDraft` returns it and the sheet asks. Restoring silently over a server state the user has not
 * seen is the failure this would otherwise introduce: a bill composed yesterday, reopened today,
 * quietly showing yesterday's unsaved numbers as though they were the bill.
 */

/** One sheet's unsaved entry. */
export interface BillDraft {
  /** `client:<projectId>` or `ra:<workOrderId>` — see `clientDraftKey` / `raDraftKey`. */
  key: string;
  /** Measured quantity per line id. Only lines with a value are kept. */
  quantities: Record<string, number>;
  /** The reasons given for over-scope lines, keyed the same way. */
  reasons?: Record<string, string>;
  /** Bill number, date and description, where the sheet collects them. */
  header?: Record<string, string>;
  /** ISO 8601, when the draft was last written. Shown to the user before they restore it. */
  savedAt: string;
}

/** The draft key for a project's client-bill sheet. */
export const clientDraftKey = (projectId: string): string =>
  `client:${projectId}`;

/** The draft key for a work order's RA bill sheet. */
export const raDraftKey = (workOrderId: string): string => `ra:${workOrderId}`;

/**
 * Writes a draft, replacing any previous one for the same sheet.
 *
 * Swallows its own failure deliberately. Draft recovery is a convenience over the real thing; a
 * browser with storage disabled, a private window, or a full quota must not make the sheet itself
 * unusable or raise an error over a keystroke.
 */
export async function saveDraft(
  draft: Omit<BillDraft, 'savedAt'>,
): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(BILL_DRAFT_STORE, 'readwrite');
    await promisify(
      tx.objectStore(BILL_DRAFT_STORE).put({
        ...draft,
        savedAt: new Date().toISOString(),
      } satisfies BillDraft),
    );
    db.close();
  } catch {
    // Nothing to report: the sheet works without this.
  }
}

/** The draft for a sheet, or `null` where there is none or storage is unavailable. */
export async function readDraft(key: string): Promise<BillDraft | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const tx = db.transaction(BILL_DRAFT_STORE, 'readonly');
    const row = await promisify(
      tx.objectStore(BILL_DRAFT_STORE).get(key) as IDBRequest<
        BillDraft | undefined
      >,
    );
    db.close();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes a sheet's draft.
 *
 * Called when the bill is composed and when the user discards the draft — the two moments the typing
 * has either become a real bill or been rejected on purpose. **Not** called on unmount: a sheet
 * closed by a dying tab is exactly the case this store exists for.
 */
export async function clearDraft(key: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(BILL_DRAFT_STORE, 'readwrite');
    await promisify(tx.objectStore(BILL_DRAFT_STORE).delete(key));
    db.close();
  } catch {
    // As above.
  }
}

/** True when the draft holds anything worth offering back. */
export function draftHasEntry(draft: BillDraft | null): boolean {
  if (!draft) return false;
  return Object.values(draft.quantities).some((value) => value > 0);
}

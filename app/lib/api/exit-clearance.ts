import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * What a leaver still owes, and what has been written off (021 US4) — the client's item 10.
 *
 * **Derived on the server, never stored.** Every obligation is read fresh from the module
 * that owns it and only waivers are persisted. The consequence that matters here: an asset
 * returned through the asset register satisfies its item with no second action, so this
 * screen never needs — and must never offer — a way to mark something returned.
 */

export const CLEARANCE_KINDS = [
  'asset_custody',
  'recoverable_kit',
  'salary_advance',
  'account_access',
] as const;
export type ClearanceKind = (typeof CLEARANCE_KINDS)[number];

const clearanceItemSchema = z.object({
  kind: z.enum(CLEARANCE_KINDS),
  /** The obligation's id in its owning module. What a waiver points at. */
  ref: z.string(),
  label: z.string(),
  /** One disambiguating fact — a site, a due date, a balance. */
  detail: z.string().nullable(),
  outstanding: z.boolean(),
  waiver: z
    .object({
      reason: z.string(),
      waivedByUserId: z.string(),
      /** Added to the backend on 2026-10-01: FR-014 needs a name, not an id. */
      waivedByName: z.string(),
      waivedAt: z.string(),
      /**
       * Who countersigned, added with the 2026-10-02 waiver change.
       *
       * `.nullable().default(null)` rather than required: a waiver applied before the
       * countersignature existed has none, and a required field here would make every historical
       * clearance fail to parse. That is the fifth time this cycle a schema and the server have had
       * to be reconciled — read the raw response, not the model.
       */
      approvedByName: z.string().nullable().default(null),
      approvedAt: z.string().nullable().default(null),
    })
    .nullable(),
  /**
   * A waiver **proposed and not yet decided**, or one that was refused (FR-016).
   *
   * Separate from `waiver`, and read as separate: until the Director decides, the obligation is
   * still outstanding and still blocks a settlement. A screen that rendered a proposal as a waiver
   * would show an exit as clearable that is not.
   */
  proposal: z
    .object({
      status: z.enum(['pending', 'rejected']),
      reason: z.string(),
      proposedByName: z.string(),
      proposedAt: z.string(),
    })
    .nullable()
    .default(null),
});

export type ClearanceItem = z.infer<typeof clearanceItemSchema>;

const exitClearanceSchema = z.object({
  exitRecordId: z.string(),
  employeeId: z.string(),
  /**
   * Obligation kinds whose module could not be asked.
   *
   * **Never a permission failure, and never "there were none".** This is "we could not
   * ask", which a reader must be able to tell from "nothing is outstanding" — the backend
   * is explicit that a clearance reporting no assets because the asset module is absent
   * would be a lie that lets somebody leave with a laptop.
   */
  unavailableSources: z.array(z.string()),
  items: z.array(clearanceItemSchema),
  /**
   * Nothing outstanding and unwaived — the gate FR-013 applies.
   *
   * Read, never recomputed here. The backend holds it false while any source could not be
   * asked, because the safe answer to "is anything outstanding?" when part of the question
   * went unanswered is "assume yes". A client recomputing from `items` would lose that and
   * would offer settlement on an incomplete picture.
   */
  settleable: z.boolean(),
});

export type ExitClearance = z.infer<typeof exitClearanceSchema>;

export async function getExitClearance(
  employeeId: string,
): Promise<ExitClearance> {
  return exitClearanceSchema.parse(
    await authFetch(`/hr/employees/${employeeId}/exit-clearance`),
  );
}

export interface WaiveInput {
  kind: ClearanceKind;
  ref: string;
  /**
   * Why the company is not pursuing this.
   *
   * The backend requires at least 10 characters, deliberately: "a mandatory field satisfied
   * by a space is not a reason, and this one writes off company money."
   */
  reason: string;
}

/** The backend's own minimum, mirrored so the form refuses before the request does. */
export const WAIVER_REASON_MIN_LENGTH = 10;

/**
 * **Requests** a waiver; writes nothing (FR-016, changed 2026-10-02).
 *
 * The response carries the clearance — still blocked — and the pending approval item. Named
 * `requestClearanceWaiver` rather than `waiveClearanceItem` because the old name described what the
 * endpoint used to do, and a function whose name claims more authority than it has is how a screen
 * ends up reporting a decision nobody made.
 */
export async function requestClearanceWaiver(
  employeeId: string,
  input: WaiveInput,
): Promise<unknown> {
  return authFetch(`/hr/employees/${employeeId}/exit-clearance/waivers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

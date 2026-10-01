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
    })
    .nullable(),
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

export async function waiveClearanceItem(
  employeeId: string,
  input: WaiveInput,
): Promise<unknown> {
  return authFetch(`/hr/employees/${employeeId}/exit-clearance/waivers`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

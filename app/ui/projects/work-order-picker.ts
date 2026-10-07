import type { WorkOrder } from '@/app/lib/api/billing';

/**
 * The value standing for "the work orders with no subcontractor recorded" (028 FR-027).
 *
 * A sentinel rather than `null`, because a `<select>` carries strings and the empty string already
 * means "do not filter". Prefixed so it cannot collide with a vendor id.
 */
export const UNASSIGNED_SUBCONTRACTOR = '__unassigned__';

/**
 * Which work orders a chosen subcontractor may be billed against (028 FR-025, FR-027).
 *
 * Three cases, and the third is the requirement rather than a nicety:
 *
 * - no subcontractor chosen → every work order on the project;
 * - a vendor chosen → that vendor's;
 * - `UNASSIGNED_SUBCONTRACTOR` → the ones with a null `partnerId`.
 *
 * **`partnerId` is nullable**, so those last orders exist and are billable. Filtered out of the
 * picker they would be unbillable with nothing on screen to say why, and the fix for one — set its
 * subcontractor — is not something a reader can know to do if they cannot see it (FR-027).
 */
export function visibleWorkOrders(
  orders: WorkOrder[],
  partnerId: string,
): WorkOrder[] {
  if (partnerId === '') return orders;
  if (partnerId === UNASSIGNED_SUBCONTRACTOR) {
    return orders.filter((order) => order.partnerId === null);
  }
  return orders.filter((order) => order.partnerId === partnerId);
}

/**
 * Whether a chosen work order is still one of the chosen subcontractor's (028 FR-026).
 *
 * The one failure this control can introduce. A selection left standing across a subcontractor
 * change composes a bill **against the wrong contract** — and it would be a plausible-looking bill,
 * measured against somebody else's award, which is the worst shape a billing error takes.
 *
 * The composer clears the selection in its change handler, which is the fix. This is the second
 * line: a rule enforced only by a handler is a rule that breaks the first time somebody adds
 * another way to change the subcontractor, and nothing would say so. Checked again at submit, where
 * being wrong actually costs something.
 *
 * Extracted as a pure function deliberately. The clearing lives in component state, where
 * **buildcore-web has no test runner to assert it** — this repository verifies its screens by a
 * documented manual pass (`specs/MANUAL-VERIFICATION.md`). A pure predicate is at least a rule
 * stated in one place and read by both the picker and the submit path, rather than a behaviour that
 * exists only as a line inside an event handler.
 */
export function workOrderBelongsToSubcontractor(
  orders: WorkOrder[],
  partnerId: string,
  workOrderId: string,
): boolean {
  if (workOrderId === '') return true;
  return visibleWorkOrders(orders, partnerId).some(
    (order) => order.id === workOrderId,
  );
}

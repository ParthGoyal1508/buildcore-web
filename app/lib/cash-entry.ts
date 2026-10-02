'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser, hasWrite, type CurrentUser } from './api/users';

/**
 * Who may record a payment in cash, and who may see a cash denomination breakup
 * (019 FR-017a, FR-017d — added 2026-10-02).
 *
 * **Two questions, not one.** `CASH_ENTRY` carries both access levels and the split is real:
 * `write` is the right to record a cash payment, `read` is the right to see a breakup. A cashier
 * holds both; a supervisor checking a payout sheet against the notes needs only the second.
 *
 * **Separate from the company's hiding setting, deliberately** (FR-017b, task T068). Those are two
 * controls answering different questions — one company-wide and about display, one per-caller and
 * about capability — and a screen that read one to decide the other would reintroduce the
 * company-wide entry block the design rejected. Nothing here reads `hideCashTransactions`, and
 * nothing that imports this should.
 *
 * The server refuses either way. This only decides what is *shown*, and of the two possible
 * mistakes, hiding a control somebody holds is the recoverable one — which is why `hasWrite` fails
 * closed and these inherit that.
 */

/** The permission name, once. Spelled in one place so a typo is a compile error, not a silent deny. */
export const CASH_ENTRY = 'CASH_ENTRY';

/** Whether this user may record a payment in cash. */
export function mayEnterCash(user: CurrentUser | undefined): boolean {
  return hasWrite(user, CASH_ENTRY);
}

/**
 * Whether this user may see a cash denomination breakup.
 *
 * Either level, not `read` alone — the backend's `maySeeCashBreakup` makes the same allowance for
 * the same reason: a role backfilled by a migration may hold `write` without `read`, and hiding a
 * note count from somebody entitled to pay against it is the failure FR-017d exists to fix.
 */
export function maySeeCashBreakup(user: CurrentUser | undefined): boolean {
  if (!user) return false;
  return user.grants.some((grant) => grant.permission === CASH_ENTRY);
}

/**
 * The signed-in user's cash rights.
 *
 * Shares the `['currentUser']` query key every screen already uses, so this adds no request —
 * TanStack Query serves it from the same cache entry.
 */
export function useCashRights(): {
  mayEnterCash: boolean;
  maySeeCashBreakup: boolean;
  isPending: boolean;
} {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  return {
    mayEnterCash: mayEnterCash(user.data),
    maySeeCashBreakup: maySeeCashBreakup(user.data),
    // Exposed so a screen can avoid flashing "you cannot do this" at somebody who can, during the
    // moment before the answer arrives.
    isPending: user.isPending,
  };
}

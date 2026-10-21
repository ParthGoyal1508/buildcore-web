'use client';

import { useQuery } from '@tanstack/react-query';

import { getCashPolicy } from './api/cash-hiding';
import { useSelectedCompanyId } from './api/company-selection';
import { getCurrentUser, hasWrite, type CurrentUser } from './api/users';

/**
 * Who may record a payment in cash, and who may see a cash denomination breakup
 * (019 FR-017a, FR-017d — added 2026-10-02).
 *
 * **Two questions, not one.** `CASH_ENTRY` carries both access levels and the split is real:
 * `write` is the right to record a cash payment, `read` is the right to see a breakup. A cashier
 * holds both; a supervisor checking a payout sheet against the notes needs only the second.
 *
 * **The company's hiding setting overrides both, since 038.** 019 kept the two apart (FR-017b): the
 * setting only masked figures and the permission alone decided who could record cash. The client
 * rejected that split on 2026-10-20 — when a company hides cash, no cash shows and *nobody*, Super
 * Admin included, may record it until the setting is turned off. So `useCashRights` answers false
 * to both questions while cash is hidden, and says so (`cashHidden`) so a screen can drop its cash
 * controls without explaining a missing permission the user may well hold.
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

/** The query key of the served company's cash policy; invalidate `['cash-policy']` for every company. */
export const cashPolicyKey = (companyId: string | null) =>
  ['cash-policy', companyId] as const;

/**
 * Whether cash is hidden for the company being worked in (038 FR-004).
 *
 * Keyed by the selected company, so switching company asks again rather than serving the other
 * company's answer. Saving the setting (`app/ui/settings/cash-visibility.tsx`) invalidates the whole
 * cache, this included, and a write refused with `CASH_HIDDEN` invalidates it too (`providers.tsx`),
 * so a stale "shown" corrects itself on the first refusal. Until the answer arrives — and whenever
 * the API cannot give one — cash counts as shown; the server enforces the rule either way.
 */
export function useCashPolicy(): { hidden: boolean; isPending: boolean } {
  const companyId = useSelectedCompanyId();
  const policy = useQuery({
    queryKey: cashPolicyKey(companyId),
    queryFn: getCashPolicy,
  });
  return { hidden: policy.data?.hidden ?? false, isPending: policy.isPending };
}

/**
 * The signed-in user's cash rights, with the company's hiding setting applied.
 *
 * Shares the `['currentUser']` query key every screen already uses, so the permission half adds no
 * request — TanStack Query serves it from the same cache entry.
 */
export function useCashRights(): {
  mayEnterCash: boolean;
  maySeeCashBreakup: boolean;
  /** Cash is hidden for this company: show no cash control and no "your role lacks Cash Entry". */
  cashHidden: boolean;
  isPending: boolean;
} {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const policy = useCashPolicy();
  return {
    mayEnterCash: !policy.hidden && mayEnterCash(user.data),
    maySeeCashBreakup: !policy.hidden && maySeeCashBreakup(user.data),
    cashHidden: policy.hidden,
    // Exposed so a screen can avoid flashing "you cannot do this" at somebody who can, during the
    // moment before the answer arrives.
    isPending: user.isPending || policy.isPending,
  };
}

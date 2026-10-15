'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getApprovalCount } from '@/app/lib/api/approvals';
import {
  listAdminClaims,
  listLeaveApplications,
} from '@/app/lib/api/hr-payroll';
import { getCurrentUser } from '@/app/lib/api/users';
import { APPROVAL_COUNT_POLL_MS, ROUTES } from '@/app/lib/constants';
import SideNavItem from '@/app/ui/dashboard/sidenav-item';

/**
 * The approvals shortcut and its pending count (spec FR-012).
 *
 * **The same mechanism as `ReminderBadge`, deliberately** — a count query, a sidenav
 * link, a pill. Principle III: a second badge mechanism would be a second set of
 * behaviours to keep in step, and the first divergence would be somebody wondering why
 * one number updates after an action and the other does not.
 *
 * Distinguished from the reminders badge by icon and colour, which FR-027 of feature 004
 * required of *that* badge for the same reason: a check against a clock, green against
 * amber/red. A reminder is something falling due; an approval is somebody waiting on you.
 *
 * **No permission gate.** Unlike `ReminderBadge`, which is enabled only for a holder of
 * `DASHBOARD`, this renders for anyone signed in — because there is no permission that
 * grants the right to approve. Authority is the chain's slot mapping, resolved per item
 * by the server, and a user holding nothing but `ATTENDANCE` may be the first approver on
 * every attendance exception in the company. The count is per-caller by construction, so
 * somebody no chain level resolves to simply sees an empty queue.
 *
 * **Permanent since 2026-10-14.** It used to hide itself whenever the queue was empty, on the
 * theory that an always-present "Approvals 0" trains people to read past it. The client asked
 * for the opposite — "Make Approvals a permanent item in the sidebar. Right now it only appears
 * when there are pending approvals" — and they have the better argument: an entry that comes and
 * goes is one nobody can find on purpose, to look up what they already decided or to check that
 * the queue really is empty. The *count* still appears only when there is something waiting, so
 * the signal that something needs attention is unchanged.
 */
export default function ApprovalBadge({
  labelled = false,
}: {
  labelled?: boolean;
} = {}) {
  const pathname = usePathname();
  const count = useApprovalTotal();
  const active =
    pathname === ROUTES.approvals ||
    pathname.startsWith(`${ROUTES.approvals}/`);

  return (
    <SideNavItem
      href={ROUTES.approvals}
      area="approvals"
      label="Approvals"
      active={active}
      labelled={labelled}
      badge={
        count > 0 && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-green-800">
            {/* The screen-reader text carries what the colour and position convey. */}
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">
              {count === 1
                ? '1 item awaiting your approval'
                : `${count} items awaiting your approval`}
            </span>
          </span>
        )
      }
    />
  );
}

/**
 * Everything awaiting the caller's decision: spine items, leave and claims. Shared with the phone
 * bar's Menu button (2026-10-15), which shows the same number — the queries are the badge's own, so
 * the two read one cache and cannot disagree.
 */
export function useApprovalTotal(): number {
  const { data } = useQuery({
    queryKey: ['approvalCount'],
    queryFn: getApprovalCount,
    // FR-013. The queue already refetches on focus; this badge could not, because it is
    // mounted on every screen and the reader is usually *not* looking at approvals — so
    // focus alone would never fire while they worked elsewhere in the app. An interval is
    // what makes the number on the nav mean something, and `refetchOnWindowFocus` is set
    // here too because the global default is false and returning to the tab should not
    // wait out the remainder of the interval.
    refetchInterval: APPROVAL_COUNT_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Leave and reimbursement claims are decided on the Approvals page too (2026-10-15), so the
  // badge counts them — read through the same queries the page lists, so the two cannot
  // disagree. Each only for someone who may decide it, as on the page.
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const permissions = user.data?.permissions ?? [];
  const leave = useQuery({
    queryKey: ['approvals', 'leave', 'pending'],
    queryFn: () => listLeaveApplications({ status: 'pending' }),
    enabled: permissions.includes('ATTENDANCE'),
    refetchInterval: APPROVAL_COUNT_POLL_MS,
    refetchIntervalInBackground: false,
  });
  const claims = useQuery({
    queryKey: ['approvals', 'claims', 'submitted'],
    queryFn: () => listAdminClaims({ status: 'submitted' }),
    enabled: permissions.includes('EMPLOYEES'),
    refetchInterval: APPROVAL_COUNT_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const count =
    (data?.count ?? 0) + (leave.data?.length ?? 0) + (claims.data?.length ?? 0);
  return count;
}

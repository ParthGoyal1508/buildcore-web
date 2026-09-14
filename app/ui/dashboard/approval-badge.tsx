'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getApprovalCount } from '@/app/lib/api/approvals';
import { ROUTES } from '@/app/lib/constants';

/**
 * The approvals shortcut and its pending count (spec FR-012).
 *
 * **The same mechanism as `ReminderBadge`, deliberately** — a count query, a sidenav
 * link, a pill. Principle III: a second badge mechanism would be a second set of
 * behaviours to keep in step, and the first divergence would be somebody wondering why
 * one number updates after an action and the other does not.
 *
 * Distinguished from the reminders badge by icon and colour, which FR-027 of feature 004
 * required of *that* badge for the same reason: a check against a clock, blue against
 * amber/red. A reminder is something falling due; an approval is somebody waiting on you.
 *
 * **No permission gate.** Unlike `ReminderBadge`, which is enabled only for a holder of
 * `DASHBOARD`, this renders for anyone signed in — because there is no permission that
 * grants the right to approve. Authority is the chain's slot mapping, resolved per item
 * by the server, and a user holding nothing but `ATTENDANCE` may be the first approver on
 * every attendance exception in the company. The count is per-caller by construction, so
 * somebody no chain level resolves to simply sees nothing.
 */
export default function ApprovalBadge() {
  const pathname = usePathname();

  const { data } = useQuery({
    queryKey: ['approvalCount'],
    queryFn: getApprovalCount,
  });

  const count = data?.count ?? 0;
  const active = pathname === ROUTES.approvals;

  // Hidden when there is nothing waiting, unlike the reminders link which is a permanent
  // destination. Approvals is a queue: an always-present "Approvals 0" trains people to
  // read past it, and the one week it says 3 they will read past it too.
  if (count === 0 && !active) return null;

  return (
    <Link
      href={ROUTES.approvals}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex h-[48px] flex-1 basis-[20%] items-center justify-center gap-2 rounded-md p-3 text-sm font-medium hover:bg-blue-50 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:w-full md:flex-none md:basis-auto md:justify-start md:p-2 md:px-3',
        active ? 'bg-blue-50 text-blue-600' : 'bg-gray-50',
      )}
    >
      <CheckCircleIcon className="w-6 shrink-0" />
      <span className="hidden md:block">Approvals</span>
      {count > 0 && (
        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-blue-800">
          {/* The screen-reader text carries what the colour and position convey. */}
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">
            {count === 1
              ? '1 item awaiting your approval'
              : `${count} items awaiting your approval`}
          </span>
        </span>
      )}
    </Link>
  );
}

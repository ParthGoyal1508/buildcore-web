'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';

import { getReminderCount } from '@/app/lib/api/dashboard';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import SideNavItem from '@/app/ui/dashboard/sidenav-item';

/**
 * The reminders shortcut and its count (spec FR-027).
 *
 * Lives in the sidenav rather than a header because this shell has no header — it is
 * a sidenav beside a content column. The count has to be visible from elsewhere or it
 * is not a badge at all, just a number on the page it describes.
 *
 * FR-027 requires it to be **visually distinguishable from the notifications badge**.
 * That badge is US4's and does not exist yet, so the distinction is made in advance
 * and deliberately: a clock icon and a severity-coloured count, against the bell and
 * neutral count US4 should use. Overdue turns the count red; anything else amber.
 * Whoever builds the bell must keep it plainly different from this.
 *
 * Not a `NAV_MODULES` entry: Reminders is part of the Dashboard module rather than a
 * module of its own, and feature 014's single-definition rule governs the module tier.
 * Rendered only for a user holding DASHBOARD, so it never becomes the dead link that
 * feature exists to prevent.
 */
export default function ReminderBadge() {
  const pathname = usePathname();
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const permitted = user?.permissions.includes('DASHBOARD') ?? false;

  const { data } = useQuery({
    queryKey: ['reminderCount'],
    queryFn: () => getReminderCount(),
    // A count nobody may read is a guaranteed 403 on every render.
    enabled: permitted,
  });

  if (!permitted) return null;

  const total = data?.total ?? 0;
  const overdue = data?.bySeverity.overdue ?? 0;
  const active =
    pathname === ROUTES.reminders || pathname.startsWith(`${ROUTES.reminders}/`);

  return (
    <SideNavItem
      href={ROUTES.reminders}
      area="reminders"
      label="Reminders"
      active={active}
      badge={
        total > 0 && (
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              overdue > 0
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-900',
            )}
          >
            {/* The screen-reader text carries what the colour conveys visually. */}
            <span aria-hidden="true">{total}</span>
            <span className="sr-only">
              {overdue > 0
                ? `${total} reminders, ${overdue} overdue`
                : `${total} reminders due`}
            </span>
          </span>
        )
      }
    />
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { BellIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useRef, useState } from 'react';

import { getNotificationCount } from '@/app/lib/api/dashboard';
import { getCurrentUser } from '@/app/lib/api/users';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import NotificationPanel from '@/app/ui/dashboard/notification-panel';

/**
 * The notifications bell and its count (spec FR-008), rendered in the shell's top bar.
 *
 * It began life in the sidenav, beside the reminders badge, because this shell had no
 * header. That put a dropdown at the bottom of a nav column: the panel had to open
 * upward and drew straight over the module links it was anchored beneath, which read as
 * a menu covering the navigation rather than a notifications tray. The top bar exists
 * for it now, so the panel opens downward into empty content space.
 *
 * Reminders stays in the sidenav: it is a link to a page, not a dropdown, so it has
 * none of that problem, and FR-027's requirement is only that the two counts be
 * *distinguishable* — a neutral blue count on a bell against the badge's severity
 * amber/red still is, and they are no longer even adjacent.
 *
 * Gated on DASHBOARD so it never becomes a guaranteed 403 — and it renders nothing at
 * all without it, leaving the top bar empty rather than showing a dead control.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const permitted = user?.permissions.includes('DASHBOARD') ?? false;

  const { data: count } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: getNotificationCount,
    enabled: permitted,
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  if (!permitted) return null;

  const total = count ?? 0;

  return (
    <div ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          total > 0 ? `Notifications, ${total} active` : 'Notifications'
        }
        // 44px square: the top bar carries a Dashboard shortcut on a surface that is
        // visible on mobile, so it holds the minimum touch target Principle VI asks of
        // this shell, the same as every sidenav target.
        className={clsx(
          'relative flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-sky-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
          open && 'bg-sky-100 text-blue-600',
        )}
      >
        <BellIcon className="w-6 shrink-0" />
        {total > 0 && (
          // Solid blue on the icon rather than a pill beside it: there is no label to
          // sit next to in the top bar. The count is `aria-hidden` because the button's
          // own label already reads it out, and announcing it twice is worse than not
          // announcing it at all.
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-semibold tabular-nums text-white"
          >
            {total}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          anchorRef={wrapperRef}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

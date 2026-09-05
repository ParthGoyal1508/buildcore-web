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
 * The notifications bell and its count (spec FR-008), rendered in the sidenav next to
 * the reminders badge. A neutral (blue) count keeps it visually distinct from the
 * reminders badge's amber/red, per FR-027. Gated on DASHBOARD so it never becomes a
 * guaranteed 403.
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
    <div
      ref={wrapperRef}
      className="relative flex-1 basis-[20%] md:w-full md:flex-none md:basis-auto"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={clsx(
          'flex h-[48px] w-full items-center justify-center gap-2 rounded-md p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:justify-start md:p-2 md:px-3',
          open ? 'bg-sky-100 text-blue-600' : 'bg-gray-50',
        )}
      >
        <BellIcon className="w-6 shrink-0" />
        <span className="hidden md:block">Notifications</span>
        {total > 0 && (
          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-blue-800">
            <span aria-hidden="true">{total}</span>
            <span className="sr-only">{total} notifications</span>
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel anchorRef={wrapperRef} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

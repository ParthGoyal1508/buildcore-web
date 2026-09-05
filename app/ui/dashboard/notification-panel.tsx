'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, type RefObject } from 'react';

import { getNotifications } from '@/app/lib/api/dashboard';

/**
 * The notifications dropdown (spec FR-008, FR-009). Lists currently-active
 * notifications only — there is no dismiss control, because a notification clears
 * itself server-side once its condition resolves. Closes on click-outside (of the
 * anchor it lives in) and on Escape (research.md §5).
 */
export default function NotificationPanel({
  anchorRef,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute left-0 top-full z-50 mt-2 max-h-96 w-72 overflow-y-auto rounded-md border border-gray-200 bg-white text-left shadow-lg"
    >
      <div className="border-b border-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
        Notifications
      </div>
      {notifications.isPending && (
        <p className="px-3 py-3 text-sm text-gray-500" role="status">
          Loading…
        </p>
      )}
      {notifications.isError && (
        <p className="px-3 py-3 text-sm text-red-600" role="alert">
          Could not load notifications.
        </p>
      )}
      {notifications.data && notifications.data.length === 0 && (
        <p className="px-3 py-3 text-sm text-gray-500">
          You’re all caught up.
        </p>
      )}
      {notifications.data && notifications.data.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {notifications.data.map((n, i) => (
            <li key={`${n.type}-${i}`}>
              <Link
                href={n.actionLink}
                onClick={onClose}
                className="block px-3 py-2 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500">{n.subtitle}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

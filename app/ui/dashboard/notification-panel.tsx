'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { errorMessage } from '@/app/lib/api/client';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/app/lib/api/dashboard';
import QueryError from '@/app/ui/query-error';
import { LoadingText } from '@/app/ui/spinner';
import { toast } from '@/app/ui/toast';
import { TextButton } from '@/app/ui/button';

/** The panel's own box, in pixels — the `w-72`/`max-h-96` it used to carry as classes.
 *  Needed as numbers because the placement below has to know how much room it wants
 *  before the browser has laid it out. */
const PANEL_WIDTH = 288;
const PANEL_MAX_HEIGHT = 384;
/** Enough of the panel to be worth showing at all; below this it flips instead. */
const PANEL_MIN_HEIGHT = 160;
/** The gap the old `mt-2` left between the bell and the panel, and the margin kept
 *  against the viewport edges so the panel never sits flush against them. */
const GAP = 8;
const VIEWPORT_MARGIN = 8;

interface Placement {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Where the panel goes, given where the bell is.
 *
 * Below the bell when there is room, above it when there is not. The bell is the last
 * control in a full-height sidenav column, so on a desktop viewport there is almost
 * never room below — which is exactly the case that used to fail.
 */
function place(anchor: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const roomBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
  const roomAbove = rect.top - GAP - VIEWPORT_MARGIN;

  // Flip only when below is genuinely too tight *and* above is better — flipping into
  // an equally cramped space would just move the problem.
  const openUp = roomBelow < PANEL_MIN_HEIGHT && roomAbove > roomBelow;
  const room = openUp ? roomAbove : roomBelow;
  const maxHeight = Math.max(
    PANEL_MIN_HEIGHT,
    Math.min(PANEL_MAX_HEIGHT, room),
  );

  // Hangs from the bell's right edge when the bell is on the right of the viewport —
  // its home in the top bar — and from its left edge otherwise. Left-aligning a 288px
  // panel to a 44px button sitting near the right margin would throw it off the screen
  // and leave the clamp below to drag it back, so it would no longer line up with
  // anything. Then clamped anyway, for the narrow viewports where neither edge fits.
  const anchorCentre = rect.left + rect.width / 2;
  const preferredLeft =
    anchorCentre > window.innerWidth / 2 ? rect.right - PANEL_WIDTH : rect.left;

  return {
    top: openUp ? rect.top - GAP - maxHeight : rect.bottom + GAP,
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        preferredLeft,
        window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
      ),
    ),
    maxHeight,
  };
}

/**
 * The notifications dropdown (spec FR-008, FR-009). Lists currently-active
 * notifications only — there is no dismiss control, because a notification clears
 * itself server-side once its condition resolves. Closes on click-outside (of either
 * the bell or the panel) and on Escape (research.md §5).
 *
 * 036 D6: each notification is read or unread. Unread ones carry a dot and bold text; opening one
 * marks it read, "Mark as read" does so without leaving, and "Mark all read" clears the badge. A
 * read notification comes back as unread only when something new arrives under it. In-app only.
 *
 * Rendered through a portal into `document.body` and positioned `fixed` against the
 * bell's own rect, rather than `absolute` inside the bell. The dashboard shell is
 * `h-screen … md:overflow-hidden`, so an absolutely-positioned panel is clipped the
 * moment it needs more room than its own column has — which is how this first failed,
 * mounted and populated but drawn below the fold. A portal escapes that regardless of
 * where the bell is later moved to, which is why the move to the top bar did not need
 * to touch it.
 */
export default function NotificationPanel({
  anchorRef,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Starts unplaced and renders nothing until the layout effect below has measured
  // the bell. Reading the ref during render would be the same "measure before layout"
  // mistake in a different spot, and the effect runs before paint, so nothing flashes
  // at the wrong coordinates in between.
  const [placement, setPlacement] = useState<Placement | null>(null);

  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  /** Optimistic: the row stops looking unread at once, and the badge follows from the server. */
  const markLocally = (match: (n: NotificationRow) => boolean) =>
    queryClient.setQueryData<NotificationRow[]>(['notifications'], (rows) =>
      rows?.map((n) => (match(n) ? { ...n, read: true } : n)),
    );
  const refreshCount = () =>
    void queryClient.invalidateQueries({ queryKey: ['notificationCount'] });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: (id) => markLocally((n) => n.id === id),
    onSettled: refreshCount,
    onError: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => markLocally(() => true),
    onSettled: refreshCount,
    onError: (e: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.error(errorMessage(e, 'Could not mark the notifications read.'));
    },
  });
  const unread = (notifications.data ?? []).filter((n) => !n.read && n.id);

  const reposition = useCallback(() => {
    if (anchorRef.current) setPlacement(place(anchorRef.current));
  }, [anchorRef]);

  useLayoutEffect(() => {
    reposition();
    window.addEventListener('resize', reposition);
    // Capture phase: the sidenav and the content column scroll independently of the
    // window, and a panel pinned to the viewport has to follow the bell when either
    // moves it.
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [reposition]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      // The panel is no longer a descendant of the anchor, so it has to be checked
      // separately — otherwise mousedown inside the panel closes it and unmounts the
      // link before its click can fire.
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current && !anchorRef.current.contains(target)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchorRef, onClose]);

  if (typeof document === 'undefined' || !placement) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      style={{
        top: placement.top,
        left: placement.left,
        width: PANEL_WIDTH,
        maxHeight: placement.maxHeight,
      }}
      className="fixed z-50 overflow-y-auto rounded-md border border-gray-200 bg-white text-left shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <span className="text-sm font-medium text-gray-700">Notifications</span>
        {unread.length > 0 && (
          <TextButton
            size="xs"
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
          >
            Mark all read
          </TextButton>
        )}
      </div>
      {notifications.isPending && (
        <p className="px-3 py-3 text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      )}
      {notifications.isError && (
        <QueryError
          compact
          className="m-2"
          error={notifications.error}
          onRetry={notifications.refetch}
          fallback="Could not load notifications."
        />
      )}
      {notifications.data && notifications.data.length === 0 && (
        <p className="px-3 py-3 text-sm text-gray-500">You’re all caught up.</p>
      )}
      {notifications.data && notifications.data.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {notifications.data.map((n, i) => (
            <li
              key={n.id ?? `${n.type}-${i}`}
              className={clsx('relative', !n.read && 'bg-brand-50/40')}
            >
              <Link
                href={n.actionLink}
                onClick={() => {
                  if (n.id && !n.read) markOne.mutate(n.id);
                  onClose();
                }}
                className="block py-2 pl-6 pr-3 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                {!n.read && (
                  <span
                    aria-hidden="true"
                    className="absolute left-2.5 top-3.5 h-2 w-2 rounded-full bg-brand-600"
                  />
                )}
                <p
                  className={clsx(
                    'text-sm text-gray-900',
                    n.read ? 'font-normal' : 'font-semibold',
                  )}
                >
                  <span className="sr-only">{n.read ? '' : 'Unread: '}</span>
                  {n.title}
                </p>
                <p className="text-xs text-gray-500">{n.subtitle}</p>
              </Link>
              {n.id && !n.read && (
                <TextButton
                  size="xs"
                  className="mb-2 ml-6"
                  onClick={() => markOne.mutate(n.id as string)}
                >
                  Mark as read
                </TextButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}

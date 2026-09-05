'use client';

import { useQuery } from '@tanstack/react-query';
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

import { getNotifications } from '@/app/lib/api/dashboard';

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

  return {
    top: openUp ? rect.top - GAP - maxHeight : rect.bottom + GAP,
    // The panel is wider than the 256px sidenav, so its left edge is clamped to keep
    // the right edge on screen rather than letting it run off a narrow viewport.
    left: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
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
 * Rendered through a portal into `document.body` and positioned `fixed` against the
 * bell's own rect, rather than `absolute` inside the bell. The dashboard shell is
 * `h-screen … md:overflow-hidden` and the bell is the last control in the sidenav
 * column, so an absolutely-positioned panel opened downward into space the shell then
 * clipped: the panel was mounted and populated but drawn below the fold, which read as
 * "the dropdown does not open". A portal escapes that clip entirely, and `place()`
 * flips the panel above the bell when there is no room beneath it.
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

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

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
        <p className="px-3 py-3 text-sm text-gray-500">You’re all caught up.</p>
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
    </div>,
    document.body,
  );
}

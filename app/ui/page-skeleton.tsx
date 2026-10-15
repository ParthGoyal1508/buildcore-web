'use client';

import { useIsFetching } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isPageLinkClick } from '@/app/ui/nav-click';

import { TableSkeleton } from '@/app/ui/skeletons';

/**
 * A page-shaped placeholder for the content area — header, a row of cards, a table — while a
 * module screen loads (2026-10-15). The client: "Can we add a full page loader/spinner (keep top nav
 * and side nav) for loading state in any sub module like HR&Payroll, Projects etc. Or skeleton
 * loader". Used by the route `loading.tsx` files and by `PageLoadingOverlay`.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="flex gap-6 border-b border-gray-200 pb-3">
        {['w-20', 'w-24', 'w-16', 'w-24', 'w-20'].map((w, i) => (
          <div key={i} className={`h-3.5 rounded bg-gray-200 ${w}`} />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="h-3 w-72 rounded bg-gray-100" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gray-100" />
              <div className="h-3 w-24 rounded bg-gray-200" />
            </div>
            <div className="h-6 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}

/**
 * Query families the shell itself runs — the user, the company switcher, the bell, the badges,
 * search. They load beside every page and are not what the reader is waiting for.
 */
const SHELL_QUERIES = new Set([
  'currentUser',
  'companies',
  'company-logo',
  'approvalCount',
  'notificationCount',
  'notifications',
  'reminderCount',
  'search',
]);

/**
 * The skeleton over the content area while a screen's first data is on its way — top bar and
 * sidebar stay usable (2026-10-15).
 *
 * Only on arrival: from a change of address until the page's first loads settle, it covers the
 * content whenever a query that has never had data is in flight. A later load on the same page —
 * a modal fetching its options, a filter, a refetch — never brings it back, because a skeleton
 * replacing a page the reader is already working in is worse than the small spinner those have.
 * It waits 200ms before appearing so a cached or quick page does not flash, and gives up after 20s
 * so a request that hangs leaves the page's own error or loading text visible.
 */
export function PageLoadingOverlay() {
  const pathname = usePathname();
  const pending = useIsFetching({
    predicate: (query) =>
      query.state.data === undefined &&
      !SHELL_QUERIES.has(String(query.queryKey[0])),
  });
  const [arriving, setArriving] = useState(true);
  const [visible, setVisible] = useState(false);
  // The page the reader is leaving, from the moment a link is followed until the next page's
  // address lands: Next keeps the old page on screen while it fetches the new one, so without
  // this the first second or two of a tab change showed the old page doing nothing.
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isPageLinkClick(event)) setLeaving(window.location.pathname);
    };
    // A row that navigates by `data-row-href` says so (`RowLinks`).
    const onNavigate = () => setLeaving(window.location.pathname);
    document.addEventListener('click', onClick);
    window.addEventListener('app:navigate', onNavigate);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('app:navigate', onNavigate);
    };
  }, []);
  // A click that never becomes a page change (a link something else handled) lets go after
  // 15s rather than holding the loader for good.
  useEffect(() => {
    if (leaving === null) return;
    const id = setTimeout(() => setLeaving(null), 15_000);
    return () => clearTimeout(id);
  }, [leaving]);
  const navigating = leaving !== null && leaving === pathname;

  // A new address starts a new arrival.
  useEffect(() => {
    const id = setTimeout(() => setArriving(true), 0);
    const giveUp = setTimeout(() => setArriving(false), 20_000);
    return () => {
      clearTimeout(id);
      clearTimeout(giveUp);
    };
  }, [pathname]);

  // The arrival ends once nothing first-time is loading; a short grace lets a page that fetches
  // in two steps (a list, then its detail) count as one arrival.
  useEffect(() => {
    if (!arriving) return;
    if (pending > 0) {
      const id = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setVisible(false);
      setArriving(false);
    }, 120);
    return () => clearTimeout(id);
  }, [pending, arriving]);

  // While the next page is fetched, after the same 200ms grace.
  const [navShown, setNavShown] = useState(false);
  useEffect(() => {
    if (!navigating) {
      // Held a moment past the address change, so the hand-over to the new page's own first
      // loads (which show after their 200ms grace) does not blink the page through.
      const id = setTimeout(() => setNavShown(false), 400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setNavShown(true), 200);
    return () => clearTimeout(id);
  }, [navigating]);

  if (!navShown && (!arriving || !visible)) return null;
  return (
    <div
      role="status"
      aria-label="Loading"
      className="absolute inset-0 z-20 overflow-hidden bg-gray-50 p-4 sm:p-6 md:px-8 md:pt-8 lg:px-12"
    >
      <PageSkeleton />
    </div>
  );
}

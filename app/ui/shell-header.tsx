'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { landingRoute } from '@/app/lib/permissions';
import NotificationBell from '@/app/ui/dashboard/notification-bell';
import { lusitana } from '@/app/ui/fonts';

/**
 * The bar every shell opens with: a wordmark on mobile, the notifications bell on
 * the right, at every width.
 *
 * Shared because the app has three shells — `/dashboard`, `/my` and the muster
 * capture screen — and only the first had one. On a phone that meant `/my/punch`
 * scrolled with nothing pinned and no way to tell which application you were in; on a
 * desktop it meant the notifications bell simply did not exist outside `/dashboard`,
 * so a site employee working in My Workspace could not see they had any.
 *
 * Sticky, which only does anything on mobile: there the shells stack and the page
 * scrolls as a whole, so this pins once the nav above it scrolls off. On desktop each
 * shell's content column is `md:overflow-hidden` with a separately-scrolling body, so
 * this is already fixed above it and `sticky` is a no-op.
 *
 * The wordmark is `md:hidden` — on a desktop the sidebar two inches to the left
 * already carries it — which is why the bell sits at the end on mobile and is the only
 * thing here on desktop.
 *
 * It links to `landingRoute()`, not to `/dashboard`. Hardcoding `/dashboard` makes it
 * a dead link for exactly the users most likely to tap it: a site employee holding
 * only `MY_WORKSPACE` has no Dashboard to go home to, and `ModuleGuard` would refuse
 * them — the dead link feature 014 exists to prevent. A user with no module at all
 * gets plain text rather than a link to nowhere.
 */
export default function ShellHeader() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // `?? ROUTES.dashboard` only while the answer is pending — the sidebar renders its
  // own wordmark against the same assumption, and a tap in that window is rare enough
  // that a guard screen is a better outcome than a heading that shifts under a thumb.
  const home = user ? landingRoute(user.permissions) : ROUTES.dashboard;

  const wordmark = (
    <span className={`${lusitana.className} text-lg text-blue-600`}>
      BuildCore
    </span>
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between gap-2 border-b border-gray-100 bg-white px-6 md:justify-end md:px-12">
      <div className="md:hidden">
        {home ? (
          <Link
            href={home}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {wordmark}
          </Link>
        ) : (
          wordmark
        )}
      </div>
      <NotificationBell />
    </header>
  );
}

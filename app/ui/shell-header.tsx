'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { landingRoute } from '@/app/lib/permissions';
import CashVisibility from '@/app/ui/settings/cash-visibility';
import CompanySwitcher from '@/app/ui/company-switcher';
import NotificationBell from '@/app/ui/dashboard/notification-bell';
import Logo from '@/app/ui/logo';

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
export default function ShellHeader({
  /**
   * Shell-specific furniture for the middle of the bar — dashboard search, today.
   *
   * A slot rather than the control itself, because this header is shared by three
   * shells and only one of them wants it. Mounting search here unconditionally would
   * put it on `/my`, where a site employee has no register to search, and on the muster
   * capture screen, where a supervisor is standing in front of a queue of workers.
   */
  children,
}: {
  children?: React.ReactNode;
}) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // `?? ROUTES.dashboard` only while the answer is pending — the sidebar renders its
  // own wordmark against the same assumption, and a tap in that window is rare enough
  // that a guard screen is a better outcome than a heading that shifts under a thumb.
  const home = user ? landingRoute(user.permissions) : ROUTES.dashboard;

  const wordmark = <Logo className="h-7" />;

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between gap-3 border-b border-gray-100 bg-white px-6 md:px-12">
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
      {/* `justify-between` on the header no longer ends in the bell on desktop, so the
          slot takes the slack and keeps the bell at the right edge. An empty slot
          collapses, which is what leaves `/my` and the muster shell as they were. */}
      <div className="flex min-w-0 flex-grow justify-end md:justify-start">
        {children}
      </div>
      {/* Mounted here rather than in the slot above, unlike search — and the difference is
          deliberate. Search belongs to one shell: a site employee in My Workspace has no register to
          search, so putting it here would be wrong for them. The switcher is right everywhere and
          hides itself where there is nothing to choose, so FR-001's "present on every screen" is met
          by mounting it once in the shared header instead of in each shell that remembers to. */}
      <CompanySwitcher />
      {/* `bugs.md` item 16 asked for this "in the main menu", and the situation it is for is
          situational — somebody walks into the room — so it has to be reachable without
          navigating to Settings first. It renders nothing at all for anybody who cannot change
          it, which is almost everybody, and hides below `sm` where the bar has no room. The same
          component also appears on the Companies settings screen, where somebody goes looking
          for it. */}
      <CashVisibility variant="compact" />
      <NotificationBell />
    </header>
  );
}

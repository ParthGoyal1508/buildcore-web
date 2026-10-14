'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { landingRoute } from '@/app/lib/permissions';
import CompanySwitcher from '@/app/ui/company-switcher';
import NotificationBell from '@/app/ui/dashboard/notification-bell';
import CompanyLogo from '@/app/ui/company-logo';
import UserMenu from '@/app/ui/user-menu';

/**
 * The bar every shell opens with: a wordmark on mobile; the company switcher, the
 * notifications bell and the signed-in user with Sign Out on the right, at every width.
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
 * The wordmark is shown at every width: the bar runs the full width of the screen above the
 * sidebar, which no longer carries a copy of its own (2026-10-15).
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

  const wordmark = (
    <CompanyLogo
      knockout
      className="h-8 max-w-[8rem] md:h-10 md:max-w-[13rem]"
    />
  );

  return (
    // The 2026-10-14 colour pass: a thin brand rule along the top edge — navy into the azure
    // accent — is the one splash of the brand on a bar that is otherwise white and has to stay
    // calm behind search and the company selector. `before:` so it costs no extra element and
    // cannot be pushed around by the flex row.
    <header className="sticky top-0 z-30 flex min-h-14 flex-none flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 px-4 py-2 text-white shadow-md after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-accent-400 after:via-accent-500 after:to-emerald-400 md:h-16 md:flex-nowrap md:py-0 md:pl-5 md:pr-3">
      {/* The logo heads the bar at every width since the bar went full width on 2026-10-15 — the
          client: "a full width nav bar with logo and other items, and then side nav bar below
          that." On a desktop its box is the sidebar's width (less the bar's own padding), so the
          search starts where the page content does. White on the navy, as on a phone. */}
      <div className="flex-none md:flex md:w-[calc(16rem-1.25rem)] md:items-center">
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
          collapses, which is what leaves `/my` and the muster shell as they were.
          On a phone the bar wraps, and the slot (search) takes a full row of its own
          rather than being squeezed to a stub between the logo and the bell. */}
      <div className="order-last flex min-w-0 basis-full justify-start empty:hidden md:order-none md:flex-grow md:basis-auto md:pr-4">
        {children}
      </div>
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {/* Mounted here rather than in the slot above, unlike search — and the difference is
            deliberate. Search belongs to one shell: a site employee in My Workspace has no
            register to search, so putting it here would be wrong for them. The switcher is right
            everywhere and hides itself where there is nothing to choose, so FR-001's "present on
            every screen" is met by mounting it once in the shared header instead of in each shell
            that remembers to. */}
        <CompanySwitcher />
        {/* The "Hide cash" toggle that sat here moved to Settings → Cash visibility on
            2026-10-14, Super Admin only and behind their password — the client: "Remove the
            'Hide Cash' option from the top navbar and move it into Settings only." */}
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

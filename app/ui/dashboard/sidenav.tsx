'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { PowerIcon } from '@heroicons/react/24/outline';
import { logout } from '@/app/lib/api/auth';
import CurrentUser from '@/app/ui/dashboard/current-user';
import Logo from '@/app/ui/logo';
import ReminderBadge from '@/app/ui/dashboard/reminder-badge';

export default function SideNav() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  }

  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      {/* A compact brand bar at one height, not `md:h-40`. That 160px was always the
          declared height but was never seen: before `shrink-0` this was a flex child
          with the default `flex-shrink: 1`, so a full module list squashed it to about
          70px, and pinning it for the scroll fix let it spring to its real size. The
          height is now what it looks like — and `items-center`, since a logo centred
          in a short band reads better than one dropped against the bottom edge the way
          the old text wordmark was. */}
      <Link
        className="mb-2 flex h-20 shrink-0 items-center justify-start rounded-md bg-blue-600 px-4"
        href="/dashboard"
      >
        <Logo knockout priority className="h-9" />
      </Link>
      {/* Mobile: a wrapping row whose items are `flex-1 basis-[20%]`, so the targets
          fill each row evenly at *any* count (feature 014 made the count variable —
          it was fixed at ten before, and a five-column grid sized for exactly that
          left three modules stranded in five narrow tracks). Ten still wrap into two
          tidy rows inside a 320px viewport, without the shell scrolling sideways, and
          every target keeps the 44px minimum Principle VI requires of this surface.
          Desktop keeps the stacked column via `md:flex-col md:flex-nowrap`. */}
      <div className="flex flex-wrap gap-2 md:min-h-0 md:grow md:flex-col md:flex-nowrap md:gap-2">
        {/*
          The scrolling half, desktop only. The module list grew past the viewport as
          features landed — twelve modules, Reminders, then the identity panel — and
          `flex-nowrap` inside the shell's `md:overflow-hidden` meant the overflow was
          simply clipped: Sign Out was still in the DOM, drawn below the fold, with
          nothing to scroll it into view.

          `contents` on anything below `md`, so these stay direct items of the wrapping
          mobile row rather than becoming one nested item of it. At `md` the display
          flips to `flex` and this becomes the scroll container.

          `min-h-0` on both this and its parent is what actually makes it scroll: a
          flex child defaults to `min-height: auto`, which refuses to shrink below its
          content, so `overflow-y-auto` would never have anything to do.
        */}
        <div className="contents md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-2 md:overflow-y-auto">
          <NavLinks />
          {/* Reminders is not a module, so it is not in NAV_MODULES and not part of
              NavLinks — it is a shortcut into the Dashboard module, rendered only for
              a user who holds DASHBOARD. It sits after the modules so it never pushes
              one out of the first mobile row. */}
          <ReminderBadge />
          {/* The notifications bell was here too, and moved to the shell's top bar: a
              dropdown anchored to the bottom of this column could only open over the
              module links above it. See notification-bell.tsx. */}
          {/* Spacer, desktop only: fills the gap under a short module list so the
              identity panel sits against the bottom. Inside the scroller rather than
              below it, because `grow` only distributes *spare* space — once the list
              is long enough to scroll there is none, and it collapses to nothing
              instead of adding a screenful of grey to scroll past. */}
          <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
        </div>
        {/* Pinned below the scroller, not carried inside it. FR-004 wants the identity
            panel and a way out present in every state — including a user whose
            permissions filtered to nothing, or could not be read at all — and a Sign
            Out you have to go looking for is not that. */}
        <div className="hidden md:block">
          <CurrentUser />
        </div>
        <button
          onClick={handleSignOut}
          className="flex h-[48px] flex-1 basis-[20%] items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-blue-50 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:w-full md:flex-none md:basis-auto md:justify-start md:p-2 md:px-3"
        >
          <PowerIcon className="w-6" />
          <div className="hidden md:block">Sign Out</div>
        </button>
      </div>
    </div>
  );
}

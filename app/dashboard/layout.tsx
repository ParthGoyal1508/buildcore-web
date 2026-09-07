import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import SideNav from '@/app/ui/dashboard/sidenav';
import SessionGuard from '@/app/ui/dashboard/session-guard';
import ModuleGuard from '@/app/ui/dashboard/module-guard';
import NotificationBell from '@/app/ui/dashboard/notification-bell';

/**
 * The dashboard shell: sidebar beside a content column, stacked on mobile.
 *
 * The root is `min-h-screen` on mobile and `h-screen` from `md`. A hard `h-screen`
 * capped the mobile content column's box at whatever the nav block left over — about
 * 350px — while its content overflowed well past it. The sticky header below is
 * bounded by its parent's box, so it would have unstuck after a few hundred pixels of
 * scrolling. `min-h-screen` lets that column's box be its content, which is what makes
 * the header stay put.
 *
 * `md:h-screen` is unchanged and still what pins the sidebar and lets the content
 * column scroll inside itself on a desktop. The same split `app/my/layout.tsx` uses.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <SessionGuard />
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      {/* The content column is now a column of its own: a fixed top bar above a
          scrolling body. `min-w-0` because a flex child defaults to `min-width: auto`
          and would otherwise be forced wide by a table or a long unbroken string
          instead of scrolling inside itself. */}
      <div className="flex min-w-0 flex-grow flex-col md:overflow-hidden">
        {/*
          The shell's first header. It exists for the notifications bell, which has
          nowhere sensible to open a dropdown from inside the nav column, and it is
          rendered whether or not the bell is (the bell needs DASHBOARD) so that the
          content below starts at the same height for every user.

          Sticky, which only does anything on mobile. There the shell stacks and the
          whole page scrolls, so this bar starts below the nav block and pins once it
          reaches the top — the module grid scrolls away and a 56px header stays. On
          desktop the parent is `md:overflow-hidden`, so this is already fixed above a
          separately-scrolling body and `sticky` is a no-op.

          The wordmark is mobile-only: it gives the pinned bar an identity and a way
          home once the blue panel above has scrolled off, and on desktop the sidebar
          two inches to the left already carries it. Which is why the bell sits at the
          end on mobile and is the only thing here on desktop.
        */}
        <header className="sticky top-0 z-30 flex h-14 flex-none items-center justify-between gap-2 border-b border-gray-100 bg-white px-6 md:justify-end md:px-12">
          <Link
            href={ROUTES.dashboard}
            className={`${lusitana.className} text-lg text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:hidden`}
          >
            BuildCore
          </Link>
          <NotificationBell />
        </header>
        <div className="flex-grow p-6 md:overflow-y-auto md:px-12 md:pb-12 md:pt-8">
          <ModuleGuard>{children}</ModuleGuard>
        </div>
      </div>
    </div>
  );
}

'use client';

import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import SideNav from '@/app/ui/dashboard/sidenav';
import LabourNav from '@/app/ui/labour/labour-nav';
import ShellHeader from '@/app/ui/shell-header';

/**
 * The muster capture shell.
 *
 * This screen lives OUTSIDE `/dashboard` (spec FR-001, matching how 003 places field
 * surfaces), so the dashboard shell's `ModuleGuard`, sidebar and padding do not reach
 * it. That is still the right route — it is a supervisor's phone flow — but for a
 * while it meant the page rendered as a bare column on a desktop: no sidebar, no
 * section tabs, none of the furniture every other screen in the app carries.
 *
 * Responsive rather than phone-only, exactly as `app/my/layout.tsx` was changed to be
 * and for the same reason recorded there: a fixed field shell drops the sidebar on a
 * desktop, so a signed-in admin who opens this URL loses every other module and gets a
 * phone layout stretched across a wide screen. Below `md` nothing changes — a single
 * narrow column with a back link, because the supervisor using it is holding a phone.
 * At `md` and up it borrows `/dashboard`'s furniture: the same `SideNav`, the same
 * content padding, and the Labour section tabs so the rest of the module is one click
 * away. The switch is pure CSS, never a JS viewport read, so there is no hydration
 * mismatch and no flash of the wrong shell.
 *
 * The `DAILY_WORKER_REGISTRY` check stands in for the `ModuleGuard` that does not
 * reach this path — the same permission the backend's muster endpoints require. No
 * `middleware.ts`: the token is in memory only.
 */
export default function MusterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }
  if (!user.permissions.includes('DAILY_WORKER_REGISTRY')) {
    return (
      <AccessDenied detail="Muster capture needs the Daily Worker Registry permission." />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 md:h-screen md:flex-row md:overflow-hidden md:bg-transparent">
      {/* Desktop only, and the same component `/dashboard` mounts, so a supervisor
          who is also an admin keeps every module they can reach. */}
      <div className="hidden flex-none md:block md:w-64">
        <SideNav />
      </div>

      {/* A column of its own so the shell header can sit above a separately
          scrolling body, the same shape `/dashboard` uses. */}
      <div className="flex min-w-0 flex-grow flex-col md:overflow-hidden">
        <ShellHeader />

        <div className="flex-grow p-4 md:overflow-y-auto md:p-12">
          {/* The sidebar's job on a phone: one way back, rather than a bottom bar of
              sections this screen does not have. */}
          <Link
            href={ROUTES.labour}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:hidden"
          >
            <ArrowLeftIcon className="w-4" aria-hidden="true" />
            Labour
          </Link>

          <LabourNav
            canSeeReports={user.permissions.includes('REPORTS')}
            className="mb-6 hidden md:block"
          />

          {/* The wizard stays a narrow column at every width — it is a form, and a
              three-step form stretched to a 1400px content area is harder to fill,
              not easier. */}
          <div className="mx-auto max-w-xl md:mx-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

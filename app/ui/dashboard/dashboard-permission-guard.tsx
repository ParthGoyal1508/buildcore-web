'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import RedirectHome from '@/app/ui/redirect-home';
import { LoadingText } from '@/app/ui/spinner';

/**
 * The DASHBOARD permission chokepoint for the Dashboard module's sub-pages
 * (Activity Log, Site, Group). `ModuleGuard` does not cover these because the
 * `dashboard` NAV_MODULES entry is `guardsSubtree: false` (see reminders/layout.tsx),
 * so each sub-page gates itself — same shape and reasoning as that layout.
 *
 * `buildcore-api` gates every endpoint with `@RequirePermissions(DASHBOARD)`, which is
 * the real enforcement; this only avoids rendering a page whose requests would 403.
 */
export default function DashboardPermissionGuard({
  children,
  also,
}: {
  children: React.ReactNode;
  /**
   * A second permission the page needs beyond `DASHBOARD` (2026-10-10).
   *
   * The Group Dashboard is the one sub-page whose data is not its own: per-company
   * headcount and a cross-company employee search by name. The API now gates both on
   * `EMPLOYEES`, so without this the page would render a search box and an error
   * message instead of saying plainly that it is not the caller's.
   */
  also?: string | readonly string[];
}) {
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }

  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }

  // Refused by URL: home rather than a dead end (2026-10-16 access-control audit, M1).
  if (!user.permissions.includes('DASHBOARD')) {
    return <RedirectHome />;
  }

  // Every one of `also` (the Group Dashboard needs EMPLOYEES *and* CROSS_COMPANY_ACCESS).
  const extra = also === undefined ? [] : Array.isArray(also) ? also : [also];
  if (extra.some((permission) => !user.permissions.includes(permission))) {
    return <RedirectHome />;
  }

  return <>{children}</>;
}

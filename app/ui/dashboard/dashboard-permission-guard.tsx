'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';

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

  if (!user.permissions.includes('DASHBOARD')) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

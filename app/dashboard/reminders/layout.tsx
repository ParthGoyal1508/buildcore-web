'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';

/**
 * The permission chokepoint for `/dashboard/reminders`.
 *
 * A guard of its own because `ModuleGuard` does not cover this path: the `dashboard`
 * entry in `NAV_MODULES` carries `guardsSubtree: false` — deliberately, since
 * `/dashboard` prefixes every route in the shell and treating it as a subtree would
 * put every unclaimed route behind the DASHBOARD permission. `hasModuleAccess()`
 * therefore returns `'unknown-route'` here and renders it normally, exactly as it
 * does for `/dashboard/account-creation`.
 *
 * Same shape and same reasoning as `app/dashboard/projects/layout.tsx`: the token is
 * held in memory only (feature 001, `app/lib/session.ts`), so no edge guard can read
 * it. `buildcore-api` gates every reminders endpoint with
 * `@RequirePermissions(Permission.DASHBOARD)` and that is the enforcement; this only
 * avoids rendering a page whose every request would come back 403.
 */
export default function RemindersLayout({
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

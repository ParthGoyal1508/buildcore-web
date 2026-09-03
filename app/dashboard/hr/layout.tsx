'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { HR_PERMISSIONS, MESSAGES, ROUTES, type HrSection } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import HrNav from '@/app/ui/hr/hr-nav';

/**
 * The single permission chokepoint for every `/dashboard/hr/*` page.
 *
 * Same placement and same reasoning as `app/dashboard/settings/layout.tsx`: the
 * access token is held in memory only (feature 001), so `proxy.ts` cannot read it
 * and cannot make this decision at the edge. One guard at the layout boundary is
 * still better than repeating the check on each of the ten areas below it.
 *
 * As there, this is a UX affordance. `buildcore-api` guards every one of these
 * endpoints with `@RequirePermissions`, and that is what actually enforces access —
 * this only avoids rendering a page whose every request would 403.
 */
export default function HrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  // '/dashboard/hr/attendance/holidays' -> 'attendance'
  const section = pathname.split('/')[3] as HrSection | undefined;

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }

  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }

  // The HR index lists only the areas the user can reach, so it needs no
  // permission of its own — same treatment the Settings index gets.
  if (section && section in HR_PERMISSIONS) {
    if (!user.permissions.includes(HR_PERMISSIONS[section])) {
      return <AccessDenied />;
    }
  }

  // Not on the index: there the tiles are the navigation, and a strip repeating
  // them would be the same links twice with no tab active.
  if (pathname === ROUTES.hr) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-6">
      <HrNav />
      {children}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/api/users';
import { SETTINGS_PERMISSIONS, MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import SettingsNav from '@/app/ui/settings/settings-nav';
import { maySettingsAdministerUsers } from '@/app/ui/settings/sections';

/**
 * The single permission chokepoint for every `/dashboard/settings/*` page.
 *
 * research.md §2 put this in `middleware.ts`, decoding the access token's claims.
 * That is not reachable: feature 001 keeps the access token **in memory only**
 * (`app/lib/session.ts`) precisely so it never sits in a cookie, and middleware can
 * only read cookies — it never sees the token, on the server or anywhere else.
 * Moving the token into a cookie to satisfy the original design would undo a
 * deliberate security decision.
 *
 * So the check runs here instead: still one guard for all four sections rather than
 * the per-page repetition §2 rejected, just at the layout boundary rather than the
 * edge. It is a UX affordance either way — `buildcore-api` guards every one of these
 * endpoints with `@RequirePermissions`, and that is what actually enforces access.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  // '/dashboard/settings/companies/anything' -> 'companies'
  const section = pathname.split('/')[3] as
    | keyof typeof SETTINGS_PERMISSIONS
    | undefined;

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }

  // Can't confirm who this is, so can't confirm they may be here. The API would
  // refuse them anyway; this just avoids rendering the page first.
  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }

  // The Settings index itself lists only the sections the user can reach, so it
  // needs no permission of its own.
  if (section && section in SETTINGS_PERMISSIONS) {
    const required = SETTINGS_PERMISSIONS[section];
    if (!user.permissions.includes(required)) {
      return <AccessDenied />;
    }

    // Users administration additionally requires one of two roles (spec FR-010),
    // mirroring UsersAdminService.assertMayAdminister() on the backend.
    if (section === 'users') {
      if (!maySettingsAdministerUsers(user)) {
        return (
          <AccessDenied detail="Only a Super Admin or HO User can administer accounts." />
        );
      }
    }
  }

  // Not on the index: there the tiles are the navigation, and a strip repeating
  // them would be the same links twice with no tab active.
  if (pathname === ROUTES.settings) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav />
      {children}
    </div>
  );
}

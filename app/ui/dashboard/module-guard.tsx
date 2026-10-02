'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { hasModuleAccess, landingRoute } from '@/app/lib/permissions';
import { canWriteAt, isWriteByNature } from '@/app/lib/write-access';
import AccessDenied from '@/app/ui/access-denied';

/**
 * The permission chokepoint for `/dashboard/*` at the **module** tier (feature 014,
 * FR-006).
 *
 * Same placement and same reasoning as `app/dashboard/settings/layout.tsx` and
 * `app/dashboard/hr/layout.tsx`, which gate areas *within* a module: the access token is
 * held in memory only (feature 001, `app/lib/session.ts`), so `middleware.ts` and
 * `proxy.ts` never see it and cannot make this decision at the edge. Moving the token
 * into a cookie to enable an edge guard would reverse a deliberate security decision for
 * what is only a UX affordance.
 *
 * The decision comes from `hasModuleAccess()` reading the user's permissions — never
 * from what the sidebar happened to render. Omitting a link is presentation; if hiding
 * were the only thing preventing access, the restriction would be fiction and anyone
 * could type the URL (FR-007).
 *
 * As with the two guards above it: `buildcore-api` refuses these requests with
 * `@RequirePermissions` regardless, and that is the enforcement. This only avoids
 * rendering a page whose every request would come back 403.
 */
export default function ModuleGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  const access = user ? hasModuleAccess(user.permissions, pathname) : null;

  // FR-008: a user without DASHBOARD who lands on the shell's root is sent to the first
  // module they *do* hold rather than refused on arrival. Confined to the root — a
  // direct hit on some other module they cannot open is a refusal, not a redirect, or
  // every mistyped URL would silently teleport them somewhere else.
  const redirectTo =
    user && access === 'refused' && pathname === ROUTES.dashboard
      ? landingRoute(user.permissions)
      : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }

  // Can't confirm who this is, so can't confirm they may be here. The API would refuse
  // them anyway; this just avoids rendering the page first.
  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }

  if (redirectTo) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        {MESSAGES.navRedirecting}
      </p>
    );
  }

  // 019 FR-008, T025. A screen that exists only to create something refuses a reader on arrival.
  // Extending this guard rather than adding a second one (FR-016): two guards deciding the same
  // question is how they come to disagree, and the one nobody is looking at is the one that wins.
  if (isWriteByNature(pathname) && !canWriteAt(user, pathname)) {
    return (
      <AccessDenied detail="This page only creates records, and your role has read access here. The list it adds to is still open to you." />
    );
  }

  if (access === 'refused') {
    // A role with nothing assigned is a different situation from a role that simply
    // lacks *this* module, and telling someone "you can't see this page" when they can
    // see no page at all sends them hunting for the one that works (FR-009).
    if (landingRoute(user.permissions) === null) {
      return (
        <AccessDenied
          title={MESSAGES.noModulesTitle}
          detail={MESSAGES.noModulesBody}
        />
      );
    }
    return <AccessDenied />;
  }

  return <>{children}</>;
}

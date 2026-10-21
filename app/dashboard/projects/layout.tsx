'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { isDwrScreenPath } from '@/app/lib/write-access';
import {
  PROJECTS_PERMISSIONS,
  ROUTES,
  type ProjectsSection,
} from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import WorkspaceLoadError from '@/app/ui/workspace-load-error';
import ProjectsNav from '@/app/ui/projects/projects-nav';
import { LoadingText } from '@/app/ui/spinner';

/**
 * The single permission chokepoint for every `/dashboard/projects/*` page.
 *
 * tasks.md T006a puts this in `middleware.ts` with a route matcher. That is not
 * reachable and never was: feature 001 keeps the access token **in memory only**
 * (`app/lib/session.ts`) precisely so it never sits in a cookie, and middleware can
 * only read cookies. `proxy.ts` does a presence-only check on a `session_hint`
 * cookie and cannot see a single permission. Moving the token into a cookie to
 * satisfy the original task would undo a deliberate security decision.
 *
 * So the check runs here instead, exactly as `app/dashboard/settings/layout.tsx` and
 * `app/dashboard/hr/layout.tsx` do — one guard for every section rather than a
 * repeat on each page, just at the layout boundary rather than the edge.
 *
 * This is a UX affordance either way. `buildcore-api` guards every one of these
 * endpoints with `@RequirePermissions(Permission.PROJECTS)`, and that is what
 * actually enforces access; this only avoids rendering a page whose every request
 * would 403. Feature 014's `ModuleGuard` has already refused anyone without
 * `PROJECTS` before this layout mounts — the per-section check below matters for
 * the sections still to come, which the backend gates on `DWR` and
 * `PROJECT_FINANCIALS` rather than `PROJECTS`.
 */
/**
 * A project's daily work reports — `portfolio/:id/dwr` and everything beneath it — for a holder of
 * `DWR` (039).
 *
 * The section map is keyed on `portfolio`, which needs `PROJECTS`, so without this the DWR Entry
 * role (`DWR` and nothing of the portfolio) was refused the only screens it exists for. Every other
 * screen under a project still needs `PROJECTS`; the pages themselves check `DWR`.
 */
function isDwrScreen(pathname: string, permissions: readonly string[]): boolean {
  return (
    permissions.includes(PROJECTS_PERMISSIONS.dwr) && isDwrScreenPath(pathname)
  );
}

export default function ProjectsLayout({
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

  // '/dashboard/projects/portfolio/abc/edit' -> 'portfolio'
  const section = pathname.split('/')[3] as ProjectsSection | undefined;

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }

  // Can't confirm who this is, so can't confirm they may be here. The API would
  // refuse them anyway; this just avoids rendering the page first.
  if (isError || !user) {
    return <WorkspaceLoadError />;
  }

  // The Projects index lists only the sections the user can reach, so it needs no
  // permission of its own — same treatment the HR and Settings indexes get.
  if (section && section in PROJECTS_PERMISSIONS) {
    if (
      !user.permissions.includes(PROJECTS_PERMISSIONS[section]) &&
      !isDwrScreen(pathname, user.permissions)
    ) {
      return <AccessDenied />;
    }
  }

  // Not on the index: there the tiles are the navigation, and a strip repeating
  // them would be the same links twice with no tab active.
  // The phone bottom bar still takes this module's sections from the nav (2026-10-15).
  if (pathname === ROUTES.projects) {
    return (
      <>
        <ProjectsNav stripHidden />
        {children}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProjectsNav />
      {children}
    </div>
  );
}

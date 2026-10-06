'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';

/**
 * One permission, for a screen under `portfolio/:id/` (024 FR-011).
 *
 * The projects layout's `PROJECTS_PERMISSIONS` map is keyed on the **third** path segment, so it
 * sees `portfolio` for every page beneath a project and cannot tell a document tab from a billing
 * sheet or a daily work report. `FinancialsGuard` was written for that reason and now delegates
 * here, because 022's screens need the same thing with a different permission and two near-identical
 * guards is how one of them stops being maintained.
 *
 * A UX affordance, as every client-side guard in this app is: `buildcore-api` is what actually
 * enforces this. The value of saying it here is that the refusal is **legible** — without it a
 * holder of `PROJECTS` and not `DWR` gets a screen whose every request 403s, which reads as a
 * broken page rather than as a permission they do not have.
 */
export default function SectionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

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
  if (!user.permissions.includes(permission)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

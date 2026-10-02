'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';

/**
 * `PROJECT_FINANCIALS` for the billing and summary screens under `portfolio/:id/`.
 *
 * The projects layout's `PROJECTS_PERMISSIONS` map is keyed on the **third** path segment, so it
 * sees `portfolio` for every one of these pages and cannot tell a document tab from a billing sheet.
 * These three screens are money screens — the backend guards their endpoints with
 * `PROJECT_FINANCIALS` — so without this a `PROJECTS` holder would get a page whose every request
 * 403s, which reads as a broken screen rather than as a permission they do not hold.
 *
 * A UX affordance, as every client-side guard in this app is: `buildcore-api` is what actually
 * enforces this. The value of saying it here is that the refusal is legible.
 */
export default function FinancialsGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

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
  if (!user.permissions.includes('PROJECT_FINANCIALS')) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

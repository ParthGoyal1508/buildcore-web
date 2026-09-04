'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';

/**
 * Guard for the field muster capture, which lives OUTSIDE `/dashboard` (spec FR-001)
 * and so is not covered by the dashboard `ModuleGuard`. A direct
 * `DAILY_WORKER_REGISTRY` check stands in for it — the same permission the backend's
 * muster endpoints require. No `middleware.ts`: the token is in memory only.
 */
export default function MusterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isPending, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

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

  return <div className="mx-auto max-w-xl p-4">{children}</div>;
}

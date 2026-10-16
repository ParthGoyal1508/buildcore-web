'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import RedirectHome from '@/app/ui/redirect-home';
import { LoadingText } from '@/app/ui/spinner';

/**
 * Account creation is for holders of USER_MANAGEMENT (2026-10-16 access-control audit, M2).
 *
 * No module claims `/dashboard/account-creation`, so `ModuleGuard` let anyone signed in open the
 * form; the API refused the submit, but only after it had been filled in. Refused here instead,
 * the same way as any other page outside a role.
 */
export default function AccountCreationLayout({
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
        <LoadingText />
      </p>
    );
  }
  if (isError || !user) return <AccessDenied detail={MESSAGES.loadFailed} />;
  if (!user.permissions.includes('USER_MANAGEMENT')) return <RedirectHome />;
  return <>{children}</>;
}

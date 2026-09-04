'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import RecruitmentNav from '@/app/ui/recruitment/recruitment-nav';

/**
 * Section guard for `/dashboard/recruitment/*`. `ModuleGuard` already refuses the
 * subtree without `RECRUITMENT`; the reports sub-tree additionally needs `REPORTS`
 * (spec FR-002). No `middleware.ts` — the token is in memory only.
 */
export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: user, isPending, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const isModuleIndex = pathname === ROUTES.recruitment;
  const needsReports = pathname.startsWith(`${ROUTES.recruitment}/reports`);

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

  const canSeeReports = user.permissions.includes('REPORTS');
  if (needsReports && !canSeeReports) {
    return (
      <AccessDenied detail="Recruitment reports need the Reports permission." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isModuleIndex && <RecruitmentNav canSeeReports={canSeeReports} />}
      {children}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import LabourNav from '@/app/ui/labour/labour-nav';
import { CompanyProvider } from '@/app/ui/settings/company-context';

/**
 * The one place `/dashboard/labour/*` adds a permission check beyond the module
 * tier. Feature 014's `ModuleGuard` already refuses this subtree without
 * `DAILY_WORKER_REGISTRY`; the reports sub-tree additionally needs `REPORTS`
 * (spec FR-002).
 *
 * There is no `middleware.ts` — the access token lives in memory only, so the edge
 * never sees it. The guard lives at this layout boundary, exactly like Inventory,
 * Partners, HR and Settings.
 */
export default function LabourLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  const isModuleIndex = pathname === ROUTES.labour;
  const needsReports = pathname.startsWith(`${ROUTES.labour}/reports`);

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
      <AccessDenied detail="Labour reports need the Reports permission. You can still work with wage rates, workers, musters, payment sheets and advances." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isModuleIndex && <LabourNav canSeeReports={canSeeReports} />}
      {/*
        Renders a company selector for a cross-company administrator and nothing at all
        for everyone else — the same treatment Plant and Assets already mount over their
        whole subtree, and for the reason `company-context.tsx` documents: without a
        company named, `companyScope()` on the API side returns every tenant's rows, so
        two companies' six skill categories arrived as twelve entries listed in pairs
        with nothing on screen saying which was which.
      */}
      <CompanyProvider>{children}</CompanyProvider>
    </div>
  );
}

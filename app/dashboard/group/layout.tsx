import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import DashboardPermissionGuard from '@/app/ui/dashboard/dashboard-permission-guard';

export default function GroupDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Group-level users only (2026-10-16 access-control audit, H1): the API now refuses
    // everyone else, and a single-company user opening this by URL is sent home.
    <DashboardPermissionGuard also={['EMPLOYEES', 'CROSS_COMPANY_ACCESS']}>
      <div className="flex flex-col gap-6">
        <DashboardNav />
        {children}
      </div>
    </DashboardPermissionGuard>
  );
}

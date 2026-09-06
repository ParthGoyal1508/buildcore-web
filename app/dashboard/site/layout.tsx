import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import DashboardPermissionGuard from '@/app/ui/dashboard/dashboard-permission-guard';

export default function SiteDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardPermissionGuard>
      <div className="flex flex-col gap-6">
        <DashboardNav />
        {children}
      </div>
    </DashboardPermissionGuard>
  );
}

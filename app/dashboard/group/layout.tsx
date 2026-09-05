import DashboardPermissionGuard from '@/app/ui/dashboard/dashboard-permission-guard';

export default function GroupDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardPermissionGuard>{children}</DashboardPermissionGuard>;
}

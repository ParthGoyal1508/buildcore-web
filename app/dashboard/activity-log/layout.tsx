import DashboardPermissionGuard from '@/app/ui/dashboard/dashboard-permission-guard';

export default function ActivityLogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardPermissionGuard>{children}</DashboardPermissionGuard>;
}

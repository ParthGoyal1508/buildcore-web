import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import DashboardPermissionGuard from '@/app/ui/dashboard/dashboard-permission-guard';

/**
 * `/dashboard/reminders` needs a permission chokepoint of its own because
 * `ModuleGuard` does not cover this path: the `dashboard` entry in `NAV_MODULES`
 * carries `guardsSubtree: false` — deliberately, since `/dashboard` prefixes every
 * route in the shell and treating it as a subtree would put every unclaimed route
 * behind the DASHBOARD permission. That check is `DashboardPermissionGuard`, shared
 * with the Site, Group and Activity Log layouts, which is what this file used to
 * duplicate line for line.
 */
export default function RemindersLayout({
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

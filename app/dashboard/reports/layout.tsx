import DashboardNav from '@/app/ui/dashboard/dashboard-nav';

/**
 * Reports carries the Dashboard strip but not the DASHBOARD guard: it is a
 * `NAV_MODULES` entry of its own with `guardsSubtree: true`, so feature 014's
 * `ModuleGuard` has already refused anyone without REPORTS by the time this renders.
 * Adding a DASHBOARD check here would lock out a reports-only user from the one
 * module they do hold.
 */
export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardNav />
      {children}
    </div>
  );
}

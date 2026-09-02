import SideNav from '@/app/ui/dashboard/sidenav';
import SessionGuard from '@/app/ui/dashboard/session-guard';
import ModuleGuard from '@/app/ui/dashboard/module-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <SessionGuard />
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
        <ModuleGuard>{children}</ModuleGuard>
      </div>
    </div>
  );
}

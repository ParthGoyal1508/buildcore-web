import SideNav from '@/app/ui/dashboard/sidenav';
import SessionGuard from '@/app/ui/dashboard/session-guard';
import ModuleGuard from '@/app/ui/dashboard/module-guard';
import NotificationBell from '@/app/ui/dashboard/notification-bell';

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
      {/* The content column is now a column of its own: a fixed top bar above a
          scrolling body. `min-w-0` because a flex child defaults to `min-width: auto`
          and would otherwise be forced wide by a table or a long unbroken string
          instead of scrolling inside itself. */}
      <div className="flex min-w-0 flex-grow flex-col md:overflow-hidden">
        {/* The shell's first header. It exists for the notifications bell, which has
            nowhere sensible to open a dropdown from inside the nav column, and it is
            rendered whether or not the bell is (the bell needs DASHBOARD) so that the
            content below starts at the same height for every user. */}
        <header className="flex h-14 flex-none items-center justify-end gap-2 border-b border-gray-100 bg-white px-6 md:px-12">
          <NotificationBell />
        </header>
        <div className="flex-grow p-6 md:overflow-y-auto md:px-12 md:pb-12 md:pt-8">
          <ModuleGuard>{children}</ModuleGuard>
        </div>
      </div>
    </div>
  );
}

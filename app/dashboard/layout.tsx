import SideNav from '@/app/ui/dashboard/sidenav';
import SessionGuard from '@/app/ui/dashboard/session-guard';
import ModuleGuard from '@/app/ui/dashboard/module-guard';
import ShellHeader from '@/app/ui/shell-header';

/**
 * The dashboard shell: sidebar beside a content column, stacked on mobile.
 *
 * The root is `min-h-screen` on mobile and `h-screen` from `md`. A hard `h-screen`
 * capped the mobile content column's box at whatever the nav block left over — about
 * 350px — while its content overflowed well past it. `ShellHeader` is sticky and a
 * sticky element is bounded by its parent's box, so it would have unstuck after a few
 * hundred pixels of scrolling. `min-h-screen` lets that column's box be its content,
 * which is what makes the header stay put.
 *
 * `md:h-screen` is unchanged and still what pins the sidebar and lets the content
 * column scroll inside itself on a desktop. The same split `app/my/layout.tsx` uses.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <SessionGuard />
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      {/* The content column is now a column of its own: a fixed top bar above a
          scrolling body. `min-w-0` because a flex child defaults to `min-width: auto`
          and would otherwise be forced wide by a table or a long unbroken string
          instead of scrolling inside itself. */}
      <div className="flex min-w-0 flex-grow flex-col md:overflow-hidden">
        <ShellHeader />
        <div className="flex-grow p-6 md:overflow-y-auto md:px-12 md:pb-12 md:pt-8">
          <ModuleGuard>{children}</ModuleGuard>
        </div>
      </div>
    </div>
  );
}

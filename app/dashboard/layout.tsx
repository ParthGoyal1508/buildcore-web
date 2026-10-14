import DashboardSearch from '@/app/ui/dashboard-search';
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
 *
 * `md:fixed md:inset-0` is what actually stops the document scrolling. `md:h-screen` with
 * `md:overflow-hidden` sizes and clips this box correctly — but the box stays in normal flow, and
 * the layout overflow of the scrolling column inside it still reaches the viewport's own scroll
 * area. The result was a page that scrolled wherever the pointer was *not* over the inner
 * scroller: 610px of blank space on a project's Client bills tab, and 35px on every other
 * dashboard page. Measured, not reasoned about — a dispatched wheel over the sidebar moved the
 * document while the same wheel over the grid did not.
 *
 * Taking the shell out of flow leaves nothing for the viewport to scroll: `html.scrollHeight`
 * returns to exactly the viewport height. Only from `md`, because below it the shell is a normal
 * document that must scroll.
 *
 * **`overflow-clip` rather than `overflow-hidden`** (2026-10-12). `hidden` clips
 * without a scrollbar but still makes the box a *scroll container*, and a scroll container with no
 * scrollbar can still be scrolled — by script, and by the browser itself bringing a focused element
 * into view. Clicking the photo control on a report whose table was wider than the page focused a
 * hidden input out to the right, the browser scrolled this box 774px to reach it, the sidebar slid
 * off the screen, and nothing could scroll it back. Measured, not reasoned about.
 *
 * `clip` does not create a scroll container, so there is nothing to scroll. Both axes, because the
 * two cannot be mixed: CSS computes `clip` back to `hidden` when the other axis is `hidden`, which
 * is exactly what the first attempt at this did — `overflow-x` read back as `hidden` with the class
 * applied. Clipping is unchanged either way, and the content column inside is where scrolling
 * belongs and is untouched.
 *
 * `overflow: clip` wants Chrome 90 / Firefox 81 / Safari 16. Only the `md` shell is affected, so
 * this is a desktop floor, and a browser below it drops the declaration rather than misbehaving.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:fixed md:inset-0 md:h-screen md:overflow-clip">
      <SessionGuard />
      {/* Search is mounted here and not inside `ShellHeader`, which three shells
          share: FR-001 puts it on the dashboard, and a site employee in My Workspace
          has no register to search. The bar runs the full width, logo and all, with the
          sidebar and the content beneath it (2026-10-15). */}
      <ShellHeader>
        <DashboardSearch />
      </ShellHeader>
      <div className="flex min-h-0 min-w-0 flex-grow flex-col md:flex-row md:overflow-hidden">
        <div className="w-full flex-none md:w-64">
          <SideNav />
        </div>
        {/* The content column scrolls on its own beneath the bar. `min-w-0` because a flex child defaults to `min-width: auto`
            and would otherwise be forced wide by a table or a long unbroken string
            instead of scrolling inside itself. */}
        {/* `bg-gray-50` (slate since the 2026-10-14 colour pass): a faint cool ground under the
            content, so the white cards and tables every screen is built from read as surfaces
            instead of dissolving into a white page — half of what made the old look washed out. */}
        <div className="flex min-w-0 flex-grow flex-col bg-gray-50 md:overflow-hidden">
          <div className="flex-grow p-4 sm:p-6 md:overflow-y-auto md:px-8 md:pb-12 md:pt-8 lg:px-12">
            <ModuleGuard>{children}</ModuleGuard>
          </div>
        </div>
      </div>
    </div>
  );
}

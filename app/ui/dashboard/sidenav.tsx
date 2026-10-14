'use client';

import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import CompanyLogo from '@/app/ui/company-logo';
import ApprovalBadge from '@/app/ui/dashboard/approval-badge';
import ReminderBadge from '@/app/ui/dashboard/reminder-badge';

/**
 * The sidebar: the company's mark, then every place you can go (2026-10-14 rework).
 *
 * ## Full height, nothing pinned below the list
 *
 * The identity panel and Sign Out used to be pinned under the scrolling list, and on a short
 * laptop screen they took the bottom 130px — which is exactly where Reminders and Approvals sat,
 * so those two were "hidden behind Sign Out". Both moved to the top bar (`user-menu.tsx`), where
 * the client asked for them, and the list now has the whole column. It still scrolls inside
 * itself on a screen too short for it, but at 700px tall the desktop rows (36px — see
 * `sidenav-item.tsx`) fit every module and both shortcuts without scrolling at all.
 *
 * FR-004's "a way out in every state" is still met — the top bar renders the user menu in every
 * shell and every state, including a user whose permissions could not be read.
 *
 * ## The brand panel
 *
 * The whole column sits on the brand's palest tint, and the logo sits on it **without a box**
 * (the client: "make the background transparent, make it larger, and match the website's colour
 * scheme"). The logo is whatever each company uploaded — Parth Realcon's is navy on an opaque
 * white JPEG — so transparency cannot come from the file. `mix-blend-multiply` supplies it: white
 * multiplied by the tint *is* the tint, so a white backing disappears into the panel, while the
 * mark's own colours (anything darker than the tint) come through unchanged. It works for any
 * logo on a white or transparent background, which is what a company uploads in practice, and it
 * never alters the stored file.
 */
export default function SideNav() {
  return (
    <div className="flex h-full flex-col border-gray-200 bg-brand-50 px-3 py-3 md:border-r md:px-3 md:py-4">
      <Link
        className="mb-3 hidden h-16 shrink-0 items-center rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 md:flex"
        href="/dashboard"
      >
        <CompanyLogo
          priority
          className="h-full max-h-16 w-auto max-w-full mix-blend-multiply"
        />
      </Link>
      {/* Mobile: a wrapping row whose items are `flex-1 basis-[20%]`, so the targets fill each
          row evenly at any count. Desktop: one scrolling column. `min-h-0` is what lets a flex
          child shrink below its content so `overflow-y-auto` has something to do. */}
      <nav
        aria-label="Main"
        className="flex flex-wrap gap-2 md:-mx-1 md:min-h-0 md:flex-1 md:flex-col md:flex-nowrap md:gap-0.5 md:overflow-y-auto md:px-1 md:pb-2"
      >
        <NavLinks />
        {/* Not modules — shortcuts into the Dashboard module and the approvals queue — so they
            are not in NAV_MODULES and sit after the modules under a label of their own. The
            label is desktop-only: on a phone the icons speak for themselves. */}
        <p className="mt-3 hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 md:block">
          Workflow
        </p>
        <ApprovalBadge />
        <ReminderBadge />
      </nav>
    </div>
  );
}

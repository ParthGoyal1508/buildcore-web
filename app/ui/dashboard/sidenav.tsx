'use client';

import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';

import { IconButton } from '@/app/ui/button';
import NavLinks from '@/app/ui/dashboard/nav-links';
import ApprovalBadge from '@/app/ui/dashboard/approval-badge';
import ReminderBadge from '@/app/ui/dashboard/reminder-badge';

/**
 * The sidebar: every place you can go (2026-10-14 rework).
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
 * ## The tablet rail (036 A23)
 *
 * From 768 to 1023px the fixed 256px column left about 500px for a wide table. Between `md` and
 * `lg` the sidebar is a 64px icon rail; the toggle at its foot expands it to the full column, and
 * from `lg` up it is the full column always.
 *
 * ## The brand panel
 *
 * The whole column sits on the brand's palest tint. The company's mark is no longer here: since
 * 2026-10-15 the top bar runs the full width above this column and carries it, white on the navy.
 */
export default function SideNav() {
  // The tablet rail's expanded state (036 A23). Per visit, not remembered: the rail is the
  // default because the content needs the room, and expanding it is a moment's lookup.
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-expanded={expanded}
      className={clsx(
        // `group/side` lets every entry read `data-expanded` without a prop threaded through
        // NavLinks, ApprovalBadge and ReminderBadge. 64px rail from `md`, 256px column from `lg`.
        'group/side flex h-full flex-col border-r border-gray-200 bg-brand-50 py-4 transition-[width] duration-150',
        expanded ? 'w-64 px-3' : 'w-16 px-2 lg:w-64 lg:px-3',
      )}
    >
      {/* One scrolling column. `min-h-0` is what lets a flex child shrink below its content so
          `overflow-y-auto` has something to do. */}
      <nav
        aria-label="Main"
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 pb-2"
      >
        <NavLinks />
        {/* Not modules — shortcuts into the Dashboard module and the approvals queue — so they
            are not in NAV_MODULES and sit after the modules under a label of their own. In the
            rail, a rule stands in for the label. */}
        <p className="mt-3 hidden px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 lg:block group-data-[expanded=true]/side:block">
          Workflow
        </p>
        <hr
          aria-hidden="true"
          className="mx-2 my-2 border-gray-200 lg:hidden group-data-[expanded=true]/side:hidden"
        />
        <ApprovalBadge />
        <ReminderBadge />
      </nav>
      {/* Tablet only: at `lg` the column is always full width. */}
      <div className={clsx('pt-2 lg:hidden', expanded ? 'self-end' : 'self-center')}>
        <IconButton
          label={expanded ? 'Collapse the menu' : 'Expand the menu'}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="hover:bg-white"
        >
          {expanded ? (
            <ChevronDoubleLeftIcon aria-hidden="true" className="h-5 w-5" />
          ) : (
            <ChevronDoubleRightIcon aria-hidden="true" className="h-5 w-5" />
          )}
        </IconButton>
      </div>
    </div>
  );
}

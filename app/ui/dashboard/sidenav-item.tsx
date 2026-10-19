import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  AREA_ACCENTS,
  AREA_ICONS,
  type ShellAreaId,
} from '@/app/ui/module-theme';

/**
 * One sidebar entry — a module, Reminders or Approvals (2026-10-14).
 *
 * One component for all three because they had become three copies of one long class string,
 * and the copies had already drifted: the module links had no active state at all, so the
 * sidebar never showed where you were, while the two shortcuts did.
 *
 * **Phone**: the sidebar is not shown; the modules are listed by name in the bottom bar's Menu
 * sheet (`labelled`).
 *
 * **Tablet, 768–1023px** (036 A23): an icon rail. The full 256px column left about 500px for a
 * wide table at this width; the rail leaves 700. Each entry is its icon chip with the name as a
 * tooltip and in the accessible name; `SideNav`'s toggle expands it to the full column on demand.
 *
 * **Desktop** is a compact 36px row. The sidebar now carries twelve modules and two shortcuts
 * and has to show all of them on a 700px-tall laptop screen without scrolling — the request was
 * that Approvals and Reminders stop disappearing below the fold — and 48px rows could not. A
 * mouse does not need a thumb-sized target; the phone layout above still gets one.
 *
 * The icon sits in a chip of the area's own colour, so the sidebar is the legend for the colour
 * every module's pages carry. The active entry inverts to the brand navy, with the chip turning
 * translucent white so the glyph stays visible on it.
 */
export default function SideNavItem({
  href,
  area,
  label,
  active,
  badge,
  labelled = false,
}: {
  href: string;
  area: ShellAreaId;
  label: string;
  active: boolean;
  /** A count pill, already styled by the caller — its colour carries meaning there. */
  badge?: ReactNode;
  /**
   * The desktop row at every width — icon, name and badge on one line. The phone Menu sheet
   * (`mobile-nav.tsx`) lists the modules this way, by name, instead of as bare icons.
   */
  labelled?: boolean;
}) {
  const Icon = AREA_ICONS[area];
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      // The tooltip is what names an entry in the tablet rail, where the label is visually hidden.
      // No `aria-label` (036 A23): the label is in the link's text at every width now — visually
      // hidden in the rail, not removed — and an `aria-label` would also have hidden the badge's
      // screen-reader count ("3 items awaiting your approval") behind the bare name.
      title={label}
      className={clsx(
        'group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
        labelled
          ? 'h-11 w-full justify-start px-2 py-1'
          : // The rail (036 A23): a 40px icon square from `md` to `lg`, the 36px labelled row from
            // `lg` — or at any width once the rail is expanded (`SideNav`'s `data-expanded`).
            'h-10 w-10 shrink-0 justify-center self-center lg:h-9 lg:w-full lg:justify-start lg:px-2 lg:py-1 group-data-[expanded=true]/side:h-9 group-data-[expanded=true]/side:w-full group-data-[expanded=true]/side:justify-start group-data-[expanded=true]/side:px-2 group-data-[expanded=true]/side:py-1',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : labelled
            ? 'text-gray-700 hover:bg-brand-50 hover:text-brand-700'
            : 'text-gray-700 hover:bg-white hover:text-brand-700 hover:shadow-sm',
      )}
    >
      <span
        className={clsx(
          'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-white/15 text-white' : AREA_ACCENTS[area].chip,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        {/* In the rail the count has no room, so a dot on the icon says "something here"; the
            count itself is still read out from the visually hidden badge below. */}
        {badge && !labelled ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-brand-50 lg:hidden group-data-[expanded=true]/side:hidden"
          />
        ) : null}
      </span>
      <span
        className={clsx(
          'min-w-0',
          !labelled &&
            'sr-only lg:not-sr-only group-data-[expanded=true]/side:not-sr-only',
        )}
      >
        <span className="block truncate">{label}</span>
      </span>
      {badge ? (
        <span
          className={
            labelled
              ? 'ml-auto'
              : 'sr-only lg:not-sr-only lg:ml-auto group-data-[expanded=true]/side:not-sr-only group-data-[expanded=true]/side:ml-auto'
          }
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

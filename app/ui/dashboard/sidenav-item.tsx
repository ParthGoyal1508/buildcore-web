import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AREA_ACCENTS, AREA_ICONS, type ShellAreaId } from '@/app/ui/module-theme';

/**
 * One sidebar entry — a module, Reminders or Approvals (2026-10-14).
 *
 * One component for all three because they had become three copies of one long class string,
 * and the copies had already drifted: the module links had no active state at all, so the
 * sidebar never showed where you were, while the two shortcuts did.
 *
 * **Mobile** keeps the shape `nav-links.tsx` documented: a wrapping row of icon-only targets
 * whose items are `flex-1 basis-[20%]`, each 48px tall for Principle VI's touch minimum.
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
}: {
  href: string;
  area: ShellAreaId;
  label: string;
  active: boolean;
  /** A count pill, already styled by the caller — its colour carries meaning there. */
  badge?: ReactNode;
}) {
  const Icon = AREA_ICONS[area];
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      // The label is hidden below `md`, so the link needs a name of its own there.
      aria-label={label}
      title={label}
      className={clsx(
        'group flex h-[48px] flex-1 basis-[20%] items-center justify-center gap-3 rounded-lg p-2 text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
        'md:h-9 md:w-full md:flex-none md:basis-auto md:justify-start md:px-2 md:py-1',
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-white text-gray-700 hover:bg-white hover:text-brand-700 hover:shadow-sm md:bg-transparent',
      )}
    >
      <span
        className={clsx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-white/15 text-white' : AREA_ACCENTS[area].chip,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="hidden truncate md:block">{label}</span>
      {badge ? <span className="md:ml-auto">{badge}</span> : null}
    </Link>
  );
}

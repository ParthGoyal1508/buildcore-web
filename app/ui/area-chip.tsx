'use client';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AREA_ACCENTS, AREA_ICONS, areaForPath } from '@/app/ui/module-theme';

/**
 * A rounded chip in the current module's colour (2026-10-14 colour pass).
 *
 * The module is read from the route — the same longest-prefix rule the sidebar uses — so a page
 * heading or a landing tile is coloured like its sidebar entry without being told which module it
 * belongs to.
 *
 * A client component on its own so that `PageHeader` and `TileGrid` can stay server-compatible:
 * three server pages hand `TileGrid` icon *components*, which cannot cross into a client
 * component, while the rendered icon passed here as `children` can.
 *
 * With no `children` it draws the module's own icon; a path no module claims renders the
 * `fallback` colour, or nothing at all when `children` is absent too.
 */
export default function AreaChip({
  children,
  className,
  fallback = 'bg-brand-100 text-brand-700',
}: {
  children?: ReactNode;
  className?: string;
  fallback?: string;
}) {
  const pathname = usePathname();
  const area = areaForPath(pathname ?? '');
  if (!area && !children) return null;
  const Icon = area ? AREA_ICONS[area] : null;
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'flex shrink-0 items-center justify-center',
        area ? AREA_ACCENTS[area].chip : fallback,
        className,
      )}
    >
      {children ?? (Icon ? <Icon className="h-5 w-5" /> : null)}
    </span>
  );
}

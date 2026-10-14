import type { ComponentType, SVGProps } from 'react';
import {
  ArchiveBoxIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  CubeIcon,
  FingerPrintIcon,
  HomeIcon,
  TruckIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import { NAV_MODULES, ROUTES, type NavModuleId } from '@/app/lib/constants';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Everything that has its own place in the sidebar: the modules, plus the two shortcuts that
 * are not modules (Reminders and Approvals — see `reminder-badge.tsx` for why they are not).
 */
export type ShellAreaId = NavModuleId | 'reminders' | 'approvals';

/**
 * Icons for the sidebar areas.
 *
 * Moved here from `nav-links.tsx` (2026-10-14) because the page header and the tile grid now
 * use them too: a module's icon in the sidebar and on its own page heading should be the same
 * glyph, and two maps would be two chances to disagree. Still typed as a `Record` over the ids,
 * so a module added to `NAV_MODULES` without an icon fails to compile.
 */
export const AREA_ICONS: Record<ShellAreaId, Icon> = {
  dashboard: HomeIcon,
  hr: UsersIcon,
  projects: BriefcaseIcon,
  plant: TruckIcon,
  inventory: ArchiveBoxIcon,
  // A cube rather than another box: Inventory already owns the archive box, and the
  // two modules sitting next to each other with the same glyph is the confusion
  // 012's own spec asks the sidebar to avoid.
  assets: CubeIcon,
  partners: UserGroupIcon,
  labour: WrenchScrewdriverIcon,
  recruitment: UserPlusIcon,
  reports: ChartBarIcon,
  // A fingerprint rather than the clock it used to share with Reminders, which now sits
  // permanently in the same list: two clocks a few rows apart read as one thing twice.
  'my-workspace': FingerPrintIcon,
  settings: Cog6ToothIcon,
  reminders: ClockIcon,
  approvals: CheckCircleIcon,
};

/**
 * Each area's accent colour (2026-10-14 — "Use a more colourful palette ... Add icons
 * wherever they help").
 *
 * The colour is a way-finding cue, not decoration: the same hue marks a module's icon in the
 * sidebar, the chip beside its page heading and the icons on its landing tiles, so a reader who
 * has learned "violet is HR" knows where they are from any of them.
 *
 * Full class strings rather than a hue name interpolated at the call site, because Tailwind
 * only generates classes it can find written out in the source.
 *
 * `chip` is a pale tile with a dark glyph — every pair is a 100 background under 700 text,
 * which clears 4.5:1 in every hue here, so the glyph is legible and not just tinted.
 * `icon` is the glyph colour alone, for an icon sitting on white or the sidebar's pale panel.
 * `solid` is the strong swatch, for the active sidebar entry's chip.
 */
export const AREA_ACCENTS: Record<
  ShellAreaId,
  { chip: string; icon: string; solid: string }
> = {
  dashboard: {
    chip: 'bg-sky-100 text-sky-700',
    icon: 'text-sky-600',
    solid: 'bg-sky-500 text-white',
  },
  hr: {
    chip: 'bg-violet-100 text-violet-700',
    icon: 'text-violet-600',
    solid: 'bg-violet-500 text-white',
  },
  projects: {
    chip: 'bg-orange-100 text-orange-700',
    icon: 'text-orange-600',
    solid: 'bg-orange-500 text-white',
  },
  plant: {
    chip: 'bg-yellow-100 text-yellow-800',
    icon: 'text-yellow-600',
    solid: 'bg-yellow-500 text-white',
  },
  inventory: {
    chip: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-600',
    solid: 'bg-emerald-500 text-white',
  },
  assets: {
    chip: 'bg-teal-100 text-teal-700',
    icon: 'text-teal-600',
    solid: 'bg-teal-500 text-white',
  },
  partners: {
    chip: 'bg-indigo-100 text-indigo-700',
    icon: 'text-indigo-600',
    solid: 'bg-indigo-500 text-white',
  },
  labour: {
    chip: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-600',
    solid: 'bg-rose-500 text-white',
  },
  recruitment: {
    chip: 'bg-fuchsia-100 text-fuchsia-700',
    icon: 'text-fuchsia-600',
    solid: 'bg-fuchsia-500 text-white',
  },
  reports: {
    chip: 'bg-cyan-100 text-cyan-700',
    icon: 'text-cyan-600',
    solid: 'bg-cyan-500 text-white',
  },
  'my-workspace': {
    chip: 'bg-lime-100 text-lime-800',
    icon: 'text-lime-700',
    solid: 'bg-lime-600 text-white',
  },
  settings: {
    chip: 'bg-slate-200 text-slate-700',
    icon: 'text-slate-600',
    solid: 'bg-slate-500 text-white',
  },
  reminders: {
    chip: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-600',
    solid: 'bg-amber-500 text-white',
  },
  approvals: {
    chip: 'bg-green-100 text-green-700',
    icon: 'text-green-600',
    solid: 'bg-green-600 text-white',
  },
};

/**
 * The sidebar area a path belongs to, or null for a path none of them claims.
 *
 * Longest prefix wins, for the reason `hasModuleAccess` records: `/dashboard` is a prefix of
 * every module, so a first match would file every page under Dashboard. Reminders and Approvals
 * are checked first because they live *under* `/dashboard` without being separate modules.
 */
export function areaForPath(pathname: string): ShellAreaId | null {
  const within = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (within(ROUTES.reminders)) return 'reminders';
  if (within(ROUTES.approvals)) return 'approvals';

  let best: { id: NavModuleId; length: number } | null = null;
  for (const navModule of NAV_MODULES) {
    if (!within(navModule.guardPrefix)) continue;
    if (!best || navModule.guardPrefix.length > best.length) {
      best = { id: navModule.id, length: navModule.guardPrefix.length };
    }
  }
  return best?.id ?? null;
}

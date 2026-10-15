'use client';

import {
  BuildingOffice2Icon,
  ChartBarIcon,
  ClockIcon,
  HomeIcon,
  ListBulletIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation across the Dashboard module — the overview, the three screens that
 * hang off it, the Reminders centre, and Reports.
 *
 * These five screens were only reachable from a row of buttons on the overview, so
 * moving between any two of them meant going back to `/dashboard` first. Every other
 * module in the shell has carried a tab strip since feature 014; this is the same
 * `SectionTabs` those use, including its longest-match active rule — which this
 * strip needs more than any of them, because `/dashboard` is a prefix of every tab
 * in it and a plain `startsWith` would light Overview on all six.
 *
 * Unlike HR, Assets or Partners, the strip **does** render on the module index. Those
 * indexes are grids of tiles naming each section, so a strip there would restate them
 * with no tab active; the Dashboard index is a wall of widgets, and the row of links
 * this replaces was there precisely because nothing else on the page navigates.
 *
 * Reports is the one tab governed by a different permission: it is a NAV_MODULES
 * entry of its own, gated on REPORTS rather than DASHBOARD. So the strip is filtered
 * per tab rather than shown whole — a DASHBOARD-only user offered a Reports tab would
 * be handed the dead link feature 014 exists to prevent, and a REPORTS-only user
 * standing on `/dashboard/reports` correctly sees a strip of one.
 */
const SECTIONS = [
  {
    name: 'Overview',
    href: ROUTES.dashboard,
    permission: 'DASHBOARD',
    icon: HomeIcon,
  },
  // Overview, Group, Site — the client's order (2026-10-15): the company, then every company,
  // then one site.
  {
    name: 'Group Dashboard',
    href: ROUTES.groupDashboard,
    permission: 'DASHBOARD',
    icon: BuildingOffice2Icon,
  },
  {
    name: 'Site Dashboard',
    href: ROUTES.siteDashboard,
    permission: 'DASHBOARD',
    icon: MapPinIcon,
  },
  {
    name: 'Reminders',
    href: ROUTES.reminders,
    permission: 'DASHBOARD',
    icon: ClockIcon,
  },
  {
    name: 'Reports',
    href: ROUTES.reports,
    permission: 'REPORTS',
    icon: ChartBarIcon,
  },
  // Last since 2026-10-15, matching the overview, where the log now sits at the foot of
  // the page: the client asked for the Activity Log to come after everything else.
  {
    name: 'Activity Log',
    href: ROUTES.activityLog,
    permission: 'DASHBOARD',
    icon: ListBulletIcon,
  },
] as const;

export default function DashboardNav({ className }: { className?: string }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // Nothing rather than everything while the answer is pending: the same rule the
  // sidebar follows, so a restricted user never sees a tab flash and disappear.
  const permissions: readonly string[] = user?.permissions ?? [];
  const tabs = SECTIONS.filter((s) => permissions.includes(s.permission)).map(
    ({ name, href, icon }) => ({ name, href, icon }),
  );

  if (tabs.length === 0) return null;

  return (
    <SectionTabs
      label="Dashboard sections"
      tabs={tabs}
      className={className}
      mobile
    />
  );
}

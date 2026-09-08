'use client';

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
  { name: 'Overview', href: ROUTES.dashboard, permission: 'DASHBOARD' },
  { name: 'Site Dashboard', href: ROUTES.siteDashboard, permission: 'DASHBOARD' },
  {
    name: 'Group Dashboard',
    href: ROUTES.groupDashboard,
    permission: 'DASHBOARD',
  },
  { name: 'Activity Log', href: ROUTES.activityLog, permission: 'DASHBOARD' },
  { name: 'Reminders', href: ROUTES.reminders, permission: 'DASHBOARD' },
  { name: 'Reports', href: ROUTES.reports, permission: 'REPORTS' },
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
    ({ name, href }) => ({ name, href }),
  );

  if (tabs.length === 0) return null;

  return (
    <SectionTabs label="Dashboard sections" tabs={tabs} className={className} />
  );
}

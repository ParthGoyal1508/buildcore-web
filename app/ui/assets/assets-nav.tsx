'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { ASSETS_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import SectionTabs, { type SectionTab } from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Assets.
 *
 * Filtered on one permission only. Unlike Plant, whose sections carry five different
 * ones, everything operational here shares `ASSETS` — the module guard has already
 * established it, so those tabs always show. Masters is the exception: the backend
 * gates those routes on `SETTINGS`, because editing a company master is an
 * administrator's job, and offering the tab to a store keeper who would be refused on
 * arrival is worse than not offering it.
 */
const TABS: { tab: SectionTab; permission: string }[] = [
  {
    tab: { name: 'Register', href: ROUTES.assetsRegister },
    permission: ASSETS_PERMISSIONS.register,
  },
  {
    tab: { name: 'Allocations', href: ROUTES.assetsAllocations },
    permission: ASSETS_PERMISSIONS.allocations,
  },
  {
    tab: { name: 'Stock', href: ROUTES.assetsStock },
    permission: ASSETS_PERMISSIONS.stock,
  },
  {
    tab: { name: 'Summary', href: ROUTES.assetsSummary },
    permission: ASSETS_PERMISSIONS.summary,
  },
  {
    tab: { name: 'Masters', href: ROUTES.assetsMasters },
    permission: ASSETS_PERMISSIONS.masters,
  },
];

export default function AssetsNav() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  // Resolves from the same cache entry the sidebar and `ModuleGuard` already
  // populated, so the strip does not flash while a second request lands.
  const permissions = user?.permissions ?? [];
  const tabs = TABS.filter(({ permission }) =>
    permissions.includes(permission as never),
  ).map(({ tab }) => tab);

  if (tabs.length === 0) return null;

  return <SectionTabs label="Assets sections" tabs={tabs} />;
}

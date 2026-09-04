'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { PLANT_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import SectionTabs, { type SectionTab } from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Plant & Machinery.
 *
 * Unlike Inventory's strip, this one *is* filtered. Plant's sections do not share
 * one permission: `ModuleGuard` establishes `MACHINERY` for the subtree, but a site
 * engineer with `MACHINERY` and `LOGBOOK` has no `HIRE_BILLS` and no `MAINTENANCE`,
 * and offering them tabs that refuse on arrival is worse than not offering them.
 *
 * Masters is deliberately a tab rather than a modal, unlike Inventory's item master:
 * there are three of them with an effective-dated history between them, which is a
 * screen, not a dialog.
 */
const TABS: { tab: SectionTab; permission: string }[] = [
  {
    tab: { name: 'Register', href: ROUTES.plantEquipment },
    permission: PLANT_PERMISSIONS.equipment,
  },
  {
    tab: { name: 'Logbook', href: ROUTES.plantLogbook },
    permission: PLANT_PERMISSIONS.logbook,
  },
  {
    tab: { name: 'Fuel', href: ROUTES.plantFuel },
    permission: PLANT_PERMISSIONS.fuel,
  },
  {
    tab: { name: 'Maintenance', href: ROUTES.plantMaintenance },
    permission: PLANT_PERMISSIONS.maintenance,
  },
  {
    tab: { name: 'Services', href: ROUTES.plantServices },
    permission: PLANT_PERMISSIONS.services,
  },
  {
    tab: { name: 'Spare Parts', href: ROUTES.plantSpareParts },
    permission: PLANT_PERMISSIONS.spareParts,
  },
  {
    tab: { name: 'Hire Bills', href: ROUTES.plantHireBills },
    permission: PLANT_PERMISSIONS.hireBills,
  },
  {
    tab: { name: 'Masters', href: ROUTES.plantMasters },
    permission: PLANT_PERMISSIONS.masters,
  },
];

export default function PlantNav() {
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

  return <SectionTabs label="Plant sections" tabs={tabs} />;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, PLANT_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import PlantNav from '@/app/ui/plant/plant-nav';
import { CompanyProvider } from '@/app/ui/settings/company-context';

/**
 * The per-section permission check `/dashboard/plant/*` needs beyond the module tier.
 *
 * Feature 014's `ModuleGuard` refuses this whole subtree to anyone without
 * `MACHINERY`. That is not enough here, because unlike Inventory this module's
 * sections genuinely carry different permissions — 002's enum reserved `MACHINERY`,
 * `LOGBOOK` and `FUEL` separately, and 006 adds `MAINTENANCE` and `HIRE_BILLS` on top
 * (006 research.md §7). A site engineer holding `MACHINERY` and `LOGBOOK` would
 * otherwise reach the hire bills screen and watch it 403 on its first request.
 *
 * 006's task list called for a `middleware.ts` matcher instead (web T004a, FR-009).
 * That is not reachable: feature 001 keeps the access token in memory only, so
 * middleware never sees it — the same reason the Inventory, Partners, Settings and HR
 * guards all live at their layout boundaries rather than at the edge.
 */
const SECTION_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: ROUTES.plantEquipment, permission: PLANT_PERMISSIONS.equipment },
  { prefix: ROUTES.plantLogbook, permission: PLANT_PERMISSIONS.logbook },
  { prefix: ROUTES.plantFuel, permission: PLANT_PERMISSIONS.fuel },
  { prefix: ROUTES.plantServices, permission: PLANT_PERMISSIONS.services },
  {
    prefix: ROUTES.plantMaintenance,
    permission: PLANT_PERMISSIONS.maintenance,
  },
  { prefix: ROUTES.plantSpareParts, permission: PLANT_PERMISSIONS.spareParts },
  { prefix: ROUTES.plantHireBills, permission: PLANT_PERMISSIONS.hireBills },
  { prefix: ROUTES.plantMasters, permission: PLANT_PERMISSIONS.masters },
];

export default function PlantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    data: user,
    isPending,
    isError,
  } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });

  // The module index is a grid of tiles naming each section, so a tab bar there
  // would restate them with no tab active. Same treatment Partners and Inventory
  // give their indexes.
  const isModuleIndex = pathname === ROUTES.plant;

  // Longest match, not the first: `/plant/equipment` is a prefix of nothing here,
  // but the rule is the one `SectionTabs` and feature 014's guard already use, and
  // adopting it now means a future nested section cannot silently match its parent.
  const required = SECTION_PERMISSIONS.filter(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).reduce<{ prefix: string; permission: string } | null>(
    (best, entry) =>
      best === null || entry.prefix.length > best.prefix.length ? entry : best,
    null,
  );

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }

  if (isError || !user) {
    return <AccessDenied detail={MESSAGES.loadFailed} />;
  }

  if (
    required &&
    !user.permissions.includes(required.permission as never)
  ) {
    return (
      <AccessDenied detail="This part of Plant & Machinery needs a permission your role does not carry. The sections you can open are in the tabs above." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isModuleIndex && <PlantNav />}
      {/*
        Renders a company selector for a cross-company administrator and nothing at
        all for everyone else. Without it their lists show every tenant's rows at
        once — see `usePlantRefs` for what that looks like on the masters screen.
      */}
      <CompanyProvider>{children}</CompanyProvider>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import PartnersNav from '@/app/ui/partners/partners-nav';

/**
 * The one place `/dashboard/partners/*` adds a permission check beyond the module
 * tier.
 *
 * Feature 014's `ModuleGuard` already refuses this whole subtree to anyone without
 * `PARTNERS`, so nothing here repeats that. What it cannot know is that **vendor
 * categories are a Settings-owned master**: the table lives in the `settings` schema
 * and the backend gates it on `SETTINGS` rather than `PARTNERS` (007 FR-015). A user
 * with `PARTNERS` alone can tag a vendor with a category but cannot create one, and
 * without this check that screen would render and then 403 on its first request.
 *
 * The feature's task list called for a `middleware.ts` matcher instead. That is not
 * reachable: feature 001 keeps the access token in memory only, so middleware never
 * sees it — the same reason the Settings and HR guards live at their layout
 * boundaries rather than at the edge.
 */
export default function PartnersLayout({
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

  const needsSettings = pathname.startsWith(ROUTES.partnersVendorCategories);

  // The module index is already a grid of tiles naming each section, so the tab bar
  // there restates them — and with no tab active, since the index is not one of the
  // tabs. The tiles are that page's navigation; the tabs are how you move *between*
  // sections once inside one. Note the tiles omit Categories, which the tabs carry;
  // it stays reachable from every section's tab bar, and belongs under Vendors
  // rather than as a peer of them.
  const isModuleIndex = pathname === ROUTES.partners;

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

  if (needsSettings && !user.permissions.includes('SETTINGS')) {
    return (
      <AccessDenied detail="Vendor categories are a company master, so editing them needs the Settings permission. You can still tag vendors with the categories that already exist." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isModuleIndex && <PartnersNav />}
      {children}
    </div>
  );
}

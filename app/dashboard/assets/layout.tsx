'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { ASSETS_PERMISSIONS, MESSAGES, ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import AssetsNav from '@/app/ui/assets/assets-nav';
import { CompanyProvider } from '@/app/ui/settings/company-context';

/**
 * The per-section permission check `/dashboard/assets/*` needs beyond the module
 * tier.
 *
 * Feature 014's `ModuleGuard` refuses this whole subtree to anyone without `ASSETS`.
 * That covers every operational screen; only Masters needs more, because the backend
 * gates the three master routes on `SETTINGS` — a store keeper holding `ASSETS`
 * would otherwise reach the masters screen and watch every request on it 403.
 *
 * 012's task list called for a `middleware.ts` matcher instead (web T004, FR-002).
 * That is not reachable: feature 001 keeps the access token in memory only, so
 * middleware never sees it — the same reason the Plant, Inventory, Partners,
 * Settings and HR guards all live at their layout boundaries rather than at the edge.
 */
const SECTION_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: ROUTES.assetsMasters, permission: ASSETS_PERMISSIONS.masters },
];

export default function AssetsLayout({
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
  // would restate them with no tab active. Same treatment Plant, Partners and
  // Inventory give their indexes.
  const isModuleIndex = pathname === ROUTES.assets;

  // Longest match, not the first — the rule `SectionTabs` and feature 014's guard
  // already use, so a future nested section cannot silently match its parent.
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

  if (required && !user.permissions.includes(required.permission as never)) {
    return (
      <AccessDenied detail="Asset masters are edited under Settings permissions. The sections you can open are in the tabs above." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isModuleIndex && <AssetsNav />}
      {/*
        Renders a company selector for a cross-company administrator and nothing at
        all for everyone else. Without it their lists show every tenant's rows at
        once — see `use-asset-refs.ts` for what that looks like on the masters screen.
      */}
      <CompanyProvider>{children}</CompanyProvider>
    </div>
  );
}

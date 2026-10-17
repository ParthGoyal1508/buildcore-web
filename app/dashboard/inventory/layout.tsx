'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import AccessDenied from '@/app/ui/access-denied';
import WorkspaceLoadError from '@/app/ui/workspace-load-error';
import InventoryNav from '@/app/ui/inventory/inventory-nav';
import { LoadingText } from '@/app/ui/spinner';

/**
 * The one place `/dashboard/inventory/*` adds a permission check beyond the module
 * tier.
 *
 * Feature 014's `ModuleGuard` already refuses this whole subtree to anyone without
 * `INVENTORY`, so nothing here repeats that. What it cannot know is that the
 * **procurement view is an approver's screen**: it lists what an approved indent
 * still needs bought, and the backend gates the surrounding approval endpoints on
 * `INVENTORY_APPROVE` (009 FR-029). Without this check the screen would render and
 * then 403 on its first request.
 *
 * The item and category masters need `SETTINGS` for the same reason vendor
 * categories do — they are `settings`-schema company reference data (009
 * research.md §1). That check is not here because they are not a route: they open
 * as a modal from the Stock screen, and the button is hidden without the
 * permission, so there is no URL to guard.
 *
 * 009's task list called for a `middleware.ts` matcher instead. That is not
 * reachable: feature 001 keeps the access token in memory only, so middleware never
 * sees it — the same reason the Partners, Settings and HR guards live at their
 * layout boundaries rather than at the edge.
 */
export default function InventoryLayout({
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

  const needsApprove = pathname.startsWith(ROUTES.inventoryProcurement);

  // The module index is a grid of tiles naming each section, so a tab bar there
  // would restate them with no tab active. Same treatment Partners gives its index.
  const isModuleIndex = pathname === ROUTES.inventory;

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }

  if (isError || !user) {
    return <WorkspaceLoadError />;
  }

  if (needsApprove && !user.permissions.includes('INVENTORY_APPROVE')) {
    return (
      <AccessDenied detail="The procurement view is part of indent approval, which needs the Inventory Approve permission. You can still raise indents and see their status." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <InventoryNav stripHidden={isModuleIndex} />
      {/* The page's content is the `<main>` landmark, matching how `hr`, `projects`,
          `partners` and `settings` each mark it on their own pages. This module's
          screens had none at all — a browser pass over 103 routes found 60 with
          exactly one `<main>`, none with two, and 43 with none, and those 43 were
          this module and four others in the same shape. Marked here rather than on
          each page so the next screen added to the module inherits it. */}
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}

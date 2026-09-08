'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

import { getCurrentUser } from '@/app/lib/api/users';
import { ASSETS_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import TileGrid from '@/app/ui/tile-grid';

/**
 * The Assets module index.
 *
 * Tiles rather than a redirect to the register, matching Plant, Partners and
 * Inventory. Filtered by permission so the Masters tile is absent for a user the
 * backend would refuse — the same rule the tab strip applies.
 */
const SECTIONS = [
  {
    name: 'Register',
    href: ROUTES.assetsRegister,
    icon: ClipboardDocumentListIcon,
    permission: ASSETS_PERMISSIONS.register,
    description:
      'Every asset, where it is, who holds it, what condition it is in and what it is still worth.',
  },
  {
    name: 'Allocations',
    href: ROUTES.assetsAllocations,
    icon: ArrowsRightLeftIcon,
    permission: ASSETS_PERMISSIONS.allocations,
    description:
      'What is out on which site, who signed for it, and what is past its return date.',
  },
  {
    name: 'Stock',
    href: ROUTES.assetsStock,
    icon: ArchiveBoxIcon,
    permission: ASSETS_PERMISSIONS.stock,
    description:
      'Quantities per site — on hand, allocated and in transit kept apart, so nothing in flight looks like loss.',
  },
  {
    name: 'Summary',
    href: ROUTES.assetsSummary,
    icon: ChartPieIcon,
    permission: ASSETS_PERMISSIONS.summary,
    description:
      'Counts and book value grouped by category, status and project, and the workbook export.',
  },
  {
    name: 'Masters',
    href: ROUTES.assetsMasters,
    icon: Squares2X2Icon,
    permission: ASSETS_PERMISSIONS.masters,
    description:
      'Asset categories, document types, and the condition grades a return is graded against.',
  },
];

export default function AssetsPage() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const permissions = user?.permissions ?? [];
  const visible = SECTIONS.filter((section) =>
    permissions.includes(section.permission as never),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assets"
        description="Tools and equipment, where they are, who holds them and what they are worth."
      />
      <TileGrid tiles={visible} />
    </div>
  );
}

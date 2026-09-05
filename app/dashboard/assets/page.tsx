'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getCurrentUser } from '@/app/lib/api/users';
import { ASSETS_PERMISSIONS, ROUTES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

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
    permission: ASSETS_PERMISSIONS.register,
    description:
      'Every asset, where it is, who holds it, what condition it is in and what it is still worth.',
  },
  {
    name: 'Allocations',
    href: ROUTES.assetsAllocations,
    permission: ASSETS_PERMISSIONS.allocations,
    description:
      'What is out on which site, who signed for it, and what is past its return date.',
  },
  {
    name: 'Stock',
    href: ROUTES.assetsStock,
    permission: ASSETS_PERMISSIONS.stock,
    description:
      'Quantities per site — on hand, allocated and in transit kept apart, so nothing in flight looks like loss.',
  },
  {
    name: 'Summary',
    href: ROUTES.assetsSummary,
    permission: ASSETS_PERMISSIONS.summary,
    description:
      'Counts and book value grouped by category, status and project, and the workbook export.',
  },
  {
    name: 'Masters',
    href: ROUTES.assetsMasters,
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
      <h1 className={`${lusitana.className} text-2xl`}>Assets</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <h2 className="text-sm font-semibold text-gray-900">
              {section.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

import { ROUTES } from '@/app/lib/constants';

/**
 * Sub-navigation within Partners.
 *
 * Feature 014 made the sidebar itself role-filtered but scoped that to top-level
 * modules only, so this tier is plain navigation with no permission logic of its
 * own — everything here is reachable by anyone who reached the module, except
 * Categories, which the layout guards.
 */
const TABS = [
  { name: 'Vendors', href: ROUTES.partnersVendors },
  { name: 'Categories', href: ROUTES.partnersVendorCategories },
  { name: 'Contractors', href: ROUTES.partnersContractors },
  { name: 'Compliance', href: ROUTES.partnersCompliance },
  { name: 'RAG matrix', href: ROUTES.partnersRag },
  { name: 'BOCW cess', href: ROUTES.partnersBocw },
];

export default function PartnersNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Partners sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          // Exact match, not `startsWith`: /vendors is a prefix of
          // /vendors/categories, and a prefix test would light both tabs at once.
          const isActive =
            pathname === tab.href ||
            (tab.href !== ROUTES.partnersVendors &&
              pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  '-mb-px block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
                )}
              >
                {tab.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

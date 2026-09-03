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

  /**
   * The deepest tab whose route the current path falls under, or '' for a path under
   * no tab at all (the module index).
   *
   * A plain `startsWith` cannot decide this on its own, because two tabs' routes are
   * prefixes of other tabs' routes: /vendors of /vendors/categories, and
   * /contractors of both /contractors/compliance and /contractors/rag. Under a
   * prefix test those parents match alongside the child and two tabs light at once —
   * which is also two elements carrying aria-current="page", so a screen reader
   * announces two current pages.
   *
   * Dropping `startsWith` for an exact match is not the answer either: the contractor
   * detail page at /contractors/<id> has no tab of its own and has to light
   * Contractors. Longest match resolves both — the same rule feature 014 applies to
   * the sidebar's guardPrefix list in app/lib/permissions.ts.
   */
  const activeHref = TABS.map((tab) => tab.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce((best, href) => (href.length > best.length ? href : best), '');

  return (
    <nav aria-label="Partners sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          const isActive = tab.href === activeHref;
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

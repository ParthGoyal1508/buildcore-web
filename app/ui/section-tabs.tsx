'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export interface SectionTab {
  name: string;
  href: string;
}

/**
 * A horizontal tab strip for moving between the sections of one module.
 *
 * Shared because the active-tab rule is easy to get subtly wrong and worth having in
 * exactly one place: a tab's route can be a *prefix* of another tab's route
 * (/vendors of /vendors/categories, /contractors of /contractors/compliance), and a
 * plain `startsWith` then lights both at once — which also puts aria-current="page"
 * on two links, so a screen reader announces two current pages.
 *
 * Dropping `startsWith` for an exact match is not the fix either: a detail page such
 * as /contractors/<id> has no tab of its own and still has to light its parent.
 * Longest match satisfies both, and is the same rule feature 014 applies to the
 * sidebar's guardPrefix list in app/lib/permissions.ts.
 *
 * A path under no tab at all — a module index — lights nothing, which is correct:
 * the index is not one of the tabs.
 */
export default function SectionTabs({
  label,
  tabs,
  className,
}: {
  /** Names the strip for assistive tech, e.g. "Partners sections". */
  label: string;
  tabs: readonly SectionTab[];
  className?: string;
}) {
  const pathname = usePathname();

  const activeHref = tabs
    .map((tab) => tab.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .reduce((best, href) => (href.length > best.length ? href : best), '');

  return (
    <nav aria-label={label} className={clsx('overflow-x-auto', className)}>
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {tabs.map((tab) => {
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

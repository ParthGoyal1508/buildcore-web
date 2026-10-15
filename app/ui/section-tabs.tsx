'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { ComponentType, SVGProps } from 'react';

import { activeTabHref, useMobileSections } from '@/app/ui/mobile-nav';

export interface SectionTab {
  name: string;
  href: string;
  /** The section's glyph in the phone bottom bar (2026-10-15). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
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
  mobile = false,
  stripHidden = false,
}: {
  /** Names the strip for assistive tech, e.g. "Partners sections". */
  label: string;
  tabs: readonly SectionTab[];
  className?: string;
  /**
   * A module's own sections (2026-10-15): on a phone they move into the bottom bar
   * (`mobile-nav.tsx`) and the strip is shown from `md` only. Left off for a strip *inside* a
   * page — a project's tabs — which stays where it is at every width.
   */
  mobile?: boolean;
  /** Feed the bar but draw no strip — a module index, whose tiles already name each section. */
  stripHidden?: boolean;
}) {
  const pathname = usePathname();
  useMobileSections(label, tabs, mobile);

  const activeHref = activeTabHref(pathname, tabs);

  if (stripHidden) return null;

  return (
    <nav
      aria-label={label}
      className={clsx(
        'overflow-x-auto',
        mobile && 'hidden md:block',
        className,
      )}
    >
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  // 2026-10-14 colour pass: the active tab keeps its underline and gains a
                  // tinted face, in the accent rather than the near-black navy, so the
                  // current section is findable at a glance on a busy screen.
                  '-mb-px block whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
                  isActive
                    ? 'border-accent-600 bg-accent-50 text-brand-700'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-white hover:text-gray-900',
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

'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from 'react';

import { IconButton } from '@/app/ui/button';
import { activeTabHref, useMobileSections } from '@/app/ui/mobile-nav';

export interface SectionTab {
  name: string;
  href: string;
  /** The section's glyph in the phone bottom bar (2026-10-15). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * The path that counts as this tab when it is wider than `href` (2026-10-15): Reports opens
   * the first report, but every page under `/reports` is that tab.
   */
  match?: string;
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
  const { navRef, canLeft, canRight, scrollBy } = useOverflowCues(activeHref);

  if (stripHidden) return null;

  return (
    <div className={clsx('relative', mobile && 'hidden md:block', className)}>
      <nav ref={navRef} aria-label={label} className="overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-gray-200">
          {tabs.map((tab) => {
            const isActive = tab.href === activeHref;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive || undefined}
                  className={clsx(
                    // 2026-10-14 colour pass: the active tab keeps its underline and gains a
                    // tinted face, in the accent rather than the near-black navy, so the
                    // current section is findable at a glance on a busy screen.
                    '-mb-px block whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500',
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
      {/* Overflow cues (036 A23): Settings has fifteen sections and HR eleven, and the strip used
          to scroll with nothing to say that it could. A fade and an arrow on whichever edge has
          more. The arrows are a pointer convenience, out of the tab order and hidden from
          assistive tech — a keyboard moving through the links scrolls the strip by itself. */}
      {canLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center bg-gradient-to-r from-gray-50 via-gray-50/90 to-transparent pb-px">
          <IconButton
            size="sm"
            label="Scroll the sections left"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => scrollBy(-1)}
            className="pointer-events-auto"
          >
            <ChevronLeftIcon aria-hidden="true" className="h-5 w-5" />
          </IconButton>
        </div>
      )}
      {canRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-gray-50 via-gray-50/90 to-transparent pb-px">
          <IconButton
            size="sm"
            label="Scroll the sections right"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => scrollBy(1)}
            className="pointer-events-auto"
          >
            <ChevronRightIcon aria-hidden="true" className="h-5 w-5" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

/**
 * Whether the strip has more to either side, kept current through scrolling and resizing, and the
 * active tab brought into view when it changes — a section near the end of fifteen was otherwise
 * off the edge on arrival. `scrollLeft` is set on the strip itself, never `scrollIntoView`, which
 * would also scroll the shell's clipped columns (see `app/dashboard/layout.tsx`).
 */
function useOverflowCues(activeHref: string | undefined) {
  const navRef = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ canLeft: false, canRight: false });

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const canLeft = nav.scrollLeft > 1;
    const canRight = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
    setEdges((current) =>
      current.canLeft === canLeft && current.canRight === canRight
        ? current
        : { canLeft, canRight },
    );
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    measure();
    nav.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => {
      nav.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[data-active]');
    if (!nav || !active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < nav.scrollLeft || right > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = left - (nav.clientWidth - active.offsetWidth) / 2;
    }
  }, [activeHref]);

  const scrollBy = (direction: -1 | 1) => {
    const nav = navRef.current;
    nav?.scrollBy({ left: direction * nav.clientWidth * 0.6, behavior: 'smooth' });
  };

  return { navRef, ...edges, scrollBy };
}

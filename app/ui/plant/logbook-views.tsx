'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { ROUTES } from '@/app/lib/constants';

export const LOGBOOK_SHEET_ROUTE = `${ROUTES.plantLogbook}/sheet`;

/**
 * The two ways into the logbook (2026-10-15): the list of daily entries, and the client's
 * monthly "Vehicle Log Book and Diesel Report Sheet" for one machine. The same entries
 * underneath, so a switch between views rather than two sections of the module nav.
 */
export default function LogbookViews({
  current,
}: {
  current: 'entries' | 'sheet';
}) {
  const views = [
    { key: 'entries', label: 'Daily entries', href: ROUTES.plantLogbook },
    {
      key: 'sheet',
      label: 'Log book & diesel sheet',
      href: LOGBOOK_SHEET_ROUTE,
    },
  ] as const;
  return (
    <nav
      aria-label="Logbook views"
      className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-1 sm:w-auto"
    >
      {views.map((view) => (
        <Link
          key={view.key}
          href={view.href}
          aria-current={view.key === current ? 'page' : undefined}
          className={clsx(
            'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:flex-none',
            view.key === current
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900',
          )}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}

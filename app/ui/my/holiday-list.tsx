'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { getMyHolidays } from '@/app/lib/api/my-workspace';
import { todayIso } from '@/app/lib/format';
import { LoadingText } from '@/app/ui/spinner';

const TYPE_LABELS: Record<string, string> = {
  national: 'National',
  regional: 'Regional',
  company: 'Company',
};

/**
 * The year's holidays, as an employee reads them (2026-10-15) — the client: "as a user I don't
 * have any option to see the holiday list". Their company's holidays and their own site's, by
 * date, with the next one marked and past ones dimmed; a year switcher for planning ahead.
 */
export default function HolidayList() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data, isPending, isError } = useQuery({
    queryKey: ['my', 'holidays', year],
    queryFn: () => getMyHolidays(year),
  });
  const today = todayIso();
  const nextId = data?.holidays.find((h) => h.date >= today)?.id;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous year"
          onClick={() => setYear((y) => y - 1)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          ‹
        </button>
        <span className="min-w-16 text-center text-sm font-medium text-gray-900">
          {year}
        </span>
        <button
          type="button"
          aria-label="Next year"
          onClick={() => setYear((y) => y + 1)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          ›
        </button>
      </div>

      {isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : isError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          Could not load the holiday list.
        </p>
      ) : data.holidays.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No holidays are declared for {year}.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {data.holidays.map((holiday) => {
            const past = holiday.date < today;
            const date = new Date(`${holiday.date}T00:00:00`);
            return (
              <li
                key={holiday.id}
                className={clsx(
                  'flex items-center gap-4 px-4 py-3',
                  past && 'text-gray-400',
                  holiday.id === nextId && 'bg-green-50',
                )}
              >
                <div className="w-14 shrink-0 text-center">
                  <div className="text-xs uppercase tracking-wide">
                    {date.toLocaleDateString('en-IN', { month: 'short' })}
                  </div>
                  <div className="text-xl font-semibold leading-tight">
                    {date.getDate()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={clsx(
                      'font-medium',
                      past ? 'text-gray-500' : 'text-gray-900',
                    )}
                  >
                    {holiday.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {date.toLocaleDateString('en-IN', { weekday: 'long' })} ·{' '}
                    {TYPE_LABELS[holiday.type] ?? holiday.type}
                    {!holiday.appliesToAllSites && ' · Your site'}
                  </div>
                </div>
                {holiday.id === nextId && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Next
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getActivityLog } from '@/app/lib/api/dashboard';
import { ROUTES, activityModuleLabel } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import {
  activityTarget,
  activityWhat,
} from '@/app/ui/dashboard/activity-log-list';

/** How many entries the dashboard shows before "View full log". */
const ON_DASHBOARD = 8;

/**
 * The Activity Log, at the foot of the dashboard (2026-10-15).
 *
 * The client asked for the Activity Log to sit at the bottom of the dashboard — the
 * figures and the things needing attention first, the record of what already happened
 * last. So the home page ends with the latest few entries and a way into the full,
 * filterable log, rather than reaching it only through the tab strip at the top.
 *
 * The first page of the same `/activity-log` feed the full screen reads, unfiltered, so the
 * two can never disagree about what happened most recently. The feed is gated on
 * `DASHBOARD`, the same permission the dashboard itself is, so nobody sees this section
 * fail on a refusal.
 */
export default function RecentActivity() {
  const feed = useQuery({
    queryKey: ['activity-log', '', '', 1],
    queryFn: () => getActivityLog({ page: 1 }),
  });
  const entries = feed.data?.entries.slice(0, ON_DASHBOARD) ?? [];

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2
          id="recent-activity-heading"
          className="text-sm font-medium text-gray-700"
        >
          <Link
            href={ROUTES.activityLog}
            className="rounded hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Activity Log
          </Link>
        </h2>
        <Link
          href={ROUTES.activityLog}
          className="shrink-0 rounded text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          View full log →
        </Link>
      </div>

      {feed.isPending && (
        <p className="text-sm text-gray-500" role="status">
          Loading activity…
        </p>
      )}
      {feed.isError && (
        <p className="text-sm text-red-600" role="alert">
          Could not load the activity log.
        </p>
      )}
      {feed.data && entries.length === 0 && (
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      )}
      {entries.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5"
            >
              <span className="font-medium text-gray-900">{e.actor}</span>
              <span className="text-gray-700">{activityWhat(e)}</span>
              {activityTarget(e) && (
                <span className="min-w-0 truncate text-gray-600">
                  {activityTarget(e)}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {activityModuleLabel(e.module)} · {dateTimeLabel(e.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

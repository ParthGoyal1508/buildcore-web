'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getWidgets, type WidgetResult } from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS, ROUTES } from '@/app/lib/constants';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';
import WelcomeBanner from '@/app/ui/dashboard/welcome-banner';

const SUB_DASHBOARDS = [
  { href: ROUTES.siteDashboard, label: 'Site Dashboard' },
  { href: ROUTES.groupDashboard, label: 'Group Dashboard' },
  { href: ROUTES.activityLog, label: 'Activity Log' },
  { href: ROUTES.reminders, label: 'Reminders' },
  { href: ROUTES.reports, label: 'Reports' },
];

function section(widgets: WidgetResult[], name: string): WidgetResult[] {
  return widgets.filter((w) => w.section === name);
}

export default function DashboardPage() {
  const widgets = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: getWidgets,
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  return (
    <main>
      <WelcomeBanner />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
          Dashboard
        </h1>
        <nav className="flex flex-wrap gap-2">
          {SUB_DASHBOARDS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {widgets.isPending && (
        <p className="p-4 text-sm text-gray-500" role="status">
          Loading dashboard…
        </p>
      )}

      {widgets.isError && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-red-700">Could not load the dashboard.</p>
          <button
            onClick={() => widgets.refetch()}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {widgets.data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {section(widgets.data, 'kpi').map((w) => (
              <WidgetRenderer key={w.id} widget={w} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {section(widgets.data, 'table').map((w) => (
                <WidgetRenderer key={w.id} widget={w} />
              ))}
            </div>
            <div className="space-y-4">
              {section(widgets.data, 'sidebar').map((w) => (
                <WidgetRenderer key={w.id} widget={w} />
              ))}
              {section(widgets.data, 'alerts').map((w) => (
                <WidgetRenderer key={w.id} widget={w} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

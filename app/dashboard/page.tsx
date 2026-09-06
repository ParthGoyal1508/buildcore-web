'use client';

import { useQuery } from '@tanstack/react-query';

import { getWidgets, type WidgetResult } from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';
import WelcomeBanner from '@/app/ui/dashboard/welcome-banner';
import PageHeader from '@/app/ui/page-header';

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
      <PageHeader title="Dashboard" className="mb-4" />
      {/* The row of buttons this replaces lived only here, so reaching the Activity
          Log from the Site Dashboard meant coming back to /dashboard first. The strip
          now rides along on all six screens. */}
      <DashboardNav className="mb-6" />

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

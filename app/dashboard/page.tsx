'use client';

import { useQuery } from '@tanstack/react-query';

import { getWidgets, type WidgetResult } from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import RecentActivity from '@/app/ui/dashboard/recent-activity';
import { widgetHref } from '@/app/ui/dashboard/widget-links';
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
      {/* The tab strip first, then the page's own header — the order every other screen in
          the Dashboard module has (their layouts render the strip above the page), so the
          Overview's heading no longer sits above the divider while the rest sit below it
          (2026-10-15). */}
      <DashboardNav className="mb-6" />
      <WelcomeBanner />
      <PageHeader title="Dashboard" className="mb-4" />

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
              <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {section(widgets.data, 'table').map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
            </div>
            <div className="space-y-4">
              {section(widgets.data, 'sidebar').map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
              {section(widgets.data, 'alerts').map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Last on the page, at the client's request (2026-10-15): figures and what needs
          attention first, the record of what already happened at the foot. Outside the
          widgets block so a failed widgets call still leaves the log readable. */}
      <div className="mt-6">
        <RecentActivity />
      </div>
    </main>
  );
}

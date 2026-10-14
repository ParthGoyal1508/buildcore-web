'use client';

import { useQuery } from '@tanstack/react-query';

import { useSelectedCompany } from '@/app/lib/api/company-selection';
import { getWidgets, type WidgetResult } from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import ApprovalsCard from '@/app/ui/dashboard/approvals-card';
import DashboardNav from '@/app/ui/dashboard/dashboard-nav';
import RecentActivity from '@/app/ui/dashboard/recent-activity';
import { widgetHref } from '@/app/ui/dashboard/widget-links';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';
import WelcomeBanner from '@/app/ui/dashboard/welcome-banner';
import type { Metric } from '@/app/ui/dashboard/metric-tile';
import { SummaryBanner, widgetMetric } from '@/app/ui/dashboard/widget-metrics';
import { CompanyMark } from '@/app/ui/company-logo';
import { LoadingText } from '@/app/ui/spinner';
import PageHeader from '@/app/ui/page-header';

/** "Thursday, 15 October 2026". */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function section(widgets: WidgetResult[], name: string): WidgetResult[] {
  return widgets.filter((w) => w.section === name);
}

export default function DashboardPage() {
  const widgets = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: getWidgets,
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });
  const company = useSelectedCompany();

  const headline = [
    ...section(widgets.data ?? [], 'kpi'),
    ...section(widgets.data ?? [], 'sidebar'),
  ];
  const tiles = headline
    .map(widgetMetric)
    .filter((m): m is Metric => m !== null);
  // A headline figure a tile cannot carry — a module not yet available — keeps its card.
  const cards = headline.filter((w) => widgetMetric(w) === null);

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
          <LoadingText>Loading dashboard…</LoadingText>
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
          {/* The page's figures in the navy summary the Group Dashboard opens with
              (2026-10-15 — the client: "similar to Group Dashboard, can we enhance the
              Overview"). Every KPI and sidebar figure is a tile there, linking to its
              screen; anything a tile cannot carry keeps its card below. */}
          <SummaryBanner
            title={company?.name ?? 'Today'}
            subtitle={`Today · ${todayLabel()}`}
            mark={
              company && (
                <span className="grid h-11 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1.5">
                  <CompanyMark company={company} />
                </span>
              )
            }
            metrics={tiles}
          />

          {/* `min-w-0` on both columns: a grid item grows to its widest content by default,
              and one wide table pushed the whole page sideways on a phone. */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              {section(widgets.data, 'table').map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
            </div>
            <div className="min-w-0 space-y-4">
              {/* First in the column: a decision waiting on the reader is the one thing here
                  they act on rather than read (2026-10-15). */}
              <ApprovalsCard />
              {section(widgets.data, 'alerts').map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
              {cards.map((w) => (
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

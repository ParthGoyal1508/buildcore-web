'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getSiteWidgets,
  getSites,
  type WidgetResult,
} from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import SiteSelector from '@/app/ui/dashboard/site-selector';
import { widgetHref } from '@/app/ui/dashboard/widget-links';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';
import PageHeader from '@/app/ui/page-header';
import type { Metric } from '@/app/ui/dashboard/metric-tile';
import { SummaryBanner, widgetMetric } from '@/app/ui/dashboard/widget-metrics';
import { LoadingText } from '@/app/ui/spinner';

export default function SiteDashboardPage() {
  // The site chosen here; until somebody chooses, the first one the list offers (2026-10-15).
  // An empty page asking for a choice is a wasted click when most users have one site.
  const [chosenSiteId, setSiteId] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: getSites });
  const siteId = chosenSiteId || sites.data?.[0]?.id || '';

  const widgets = useQuery({
    queryKey: ['site-widgets', siteId],
    queryFn: () => getSiteWidgets(siteId),
    enabled: siteId !== '',
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  const kpis = (widgets.data ?? []).filter(
    (w: WidgetResult) => w.displayType !== 'table',
  );
  const tables = (widgets.data ?? []).filter(
    (w: WidgetResult) => w.displayType === 'table',
  );

  const tiles = kpis.map(widgetMetric).filter((m): m is Metric => m !== null);
  // A figure a tile cannot carry — a module not yet available — keeps its card.
  const cards = kpis.filter((w) => widgetMetric(w) === null);
  const site = sites.data?.find((s) => s.id === siteId);

  return (
    <main>
      <PageHeader
        title="Site Dashboard"
        description="Attendance, machinery, fuel and stock for one site."
        className="mb-4"
      />

      {sites.isPending && (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText>Loading sites…</LoadingText>
        </p>
      )}
      {sites.data && sites.data.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No sites yet. Add one under Projects → Sites.
        </p>
      )}

      {siteId !== '' && (
        <div className="space-y-6">
          {/* The Group Dashboard's navy summary, for one site (2026-10-15): the site's
              figures as tiles, each opening its screen, with the site chooser in the
              banner itself so changing site and reading it are one place. */}
          <SummaryBanner
            title={site?.name ?? 'Site'}
            subtitle={`Today · ${new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}`}
            mark={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15">
                <MapPinIcon className="h-5 w-5 text-white" aria-hidden />
              </span>
            }
            metrics={widgets.isPending ? [] : tiles}
          >
            <SiteSelector
              sites={sites.data ?? []}
              value={siteId}
              onChange={setSiteId}
              compact
            />
          </SummaryBanner>

          {widgets.isPending && (
            <p className="text-sm text-gray-500" role="status">
              <LoadingText>Loading this site…</LoadingText>
            </p>
          )}
          {widgets.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not load this site’s figures.
            </p>
          )}

          {cards.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((w) => (
                <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
              ))}
            </div>
          )}
          {tables.map((w) => (
            <WidgetRenderer key={w.id} widget={w} href={widgetHref(w.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

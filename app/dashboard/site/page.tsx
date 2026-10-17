'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

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
import QueryError from '@/app/ui/query-error';
import { LoadingText } from '@/app/ui/spinner';
import { longDateLabel } from '@/app/lib/format';
import { urlString, useUrlState } from '@/app/lib/use-url-state';

export default function SiteDashboardPage() {
  return (
    // The chosen site lives in the URL (`?site=`), which reads `useSearchParams` (036 E4).
    <Suspense>
      <SiteDashboard />
    </Suspense>
  );
}

function SiteDashboard() {
  // The site chosen here; until somebody chooses, the first one the list offers (2026-10-15).
  // An empty page asking for a choice is a wasted click when most users have one site. In the URL
  // since 036 E4, so Back and a refresh keep it.
  const [{ site: chosenSiteId }, setUrl] = useUrlState({ site: urlString() });
  const setSiteId = (site: string) => setUrl({ site });

  // Its own key (036 E4): `['sites']` is also HR's site list, a different endpoint with a
  // different shape, and whichever loaded first answered the other from cache.
  const sites = useQuery({
    queryKey: ['site-dashboard', 'sites'],
    queryFn: getSites,
  });
  const siteId =
    (sites.data?.some((s) => s.id === chosenSiteId) ? chosenSiteId : '') ||
    sites.data?.[0]?.id ||
    '';

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
      {/* 036 E4: a failed list used to leave a blank page. */}
      {sites.isError && (
        <QueryError
          error={sites.error}
          onRetry={sites.refetch}
          fallback="Could not load your sites."
        />
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
            subtitle={`Today · ${longDateLabel(new Date(), { year: false })}`}
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
            <QueryError
              error={widgets.error}
              onRetry={widgets.refetch}
              fallback="Could not load this site’s figures."
            />
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

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getSiteWidgets,
  getSites,
  type WidgetResult,
} from '@/app/lib/api/dashboard';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/app/lib/constants';
import SiteSelector from '@/app/ui/dashboard/site-selector';
import WidgetRenderer from '@/app/ui/dashboard/widget-renderer';

export default function SiteDashboardPage() {
  const [siteId, setSiteId] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: getSites });

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

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
          Site Dashboard
        </h1>
        <p className="text-sm text-gray-500">
          Attendance and activity for one site.
        </p>
      </div>

      <div className="mb-6">
        <SiteSelector
          sites={sites.data ?? []}
          value={siteId}
          onChange={setSiteId}
        />
      </div>

      {siteId === '' && (
        <p className="text-sm text-gray-500">
          Select a site to see its widgets.
        </p>
      )}

      {siteId !== '' && widgets.isPending && (
        <p className="text-sm text-gray-500" role="status">
          Loading site widgets…
        </p>
      )}

      {widgets.isError && (
        <p className="text-sm text-red-600" role="alert">
          Could not load this site’s widgets.
        </p>
      )}

      {widgets.data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((w) => (
              <WidgetRenderer key={w.id} widget={w} />
            ))}
          </div>
          <div className="space-y-6">
            {tables.map((w) => (
              <WidgetRenderer key={w.id} widget={w} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

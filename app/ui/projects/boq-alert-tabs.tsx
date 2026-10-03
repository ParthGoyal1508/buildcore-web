'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getBOQAlerts, type BoqAlerts, type BoqItem } from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';

type TabKey = keyof BoqAlerts;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: BOQ_COPY.tabToday },
  { key: 'delayed', label: BOQ_COPY.tabDelayed },
  { key: 'toBeDelayed', label: BOQ_COPY.tabToBeDelayed },
  // FR-048's fourth. Three tabs would mean an imported tender's lines are silently absent from
  // the one screen whose whole claim is to show what needs attention.
  { key: 'unplanned', label: BOQ_COPY.tabUnplanned },
];

/**
 * What needs attention, in **four** tabs (008 FR-048).
 *
 * The fourth is the amendment. A line with no finish date is neither late nor on time, and the
 * three-tab version of this screen had nowhere to put it — so 231 imported lines would have been
 * absent from all three and the screen would have read as "nothing needs attention" on a project
 * where nothing had been planned at all.
 *
 * A line needing nobody's attention — inside its dates and keeping pace, or finished — appears in
 * none of the four. That state exists on the tree and deliberately not here, because a tab called
 * "fine" is not an alert.
 */
export default function BoqAlertTabs({ projectId }: { projectId: string }) {
  const [active, setActive] = useState<TabKey>('today');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', projectId, 'boq-alerts'],
    queryFn: () => getBOQAlerts(projectId),
  });

  if (isLoading) return <p className="text-sm text-gray-500">{BOQ_COPY.loading}</p>;
  if (isError || !data) return <p className="text-sm text-red-700">{BOQ_COPY.loadFailed}</p>;

  const rows = data[active];

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{BOQ_COPY.alertsHeading}</h3>

      <div role="tablist" aria-label={BOQ_COPY.alertsHeading} className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`boq-tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls={`boq-panel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={`rounded-t-md border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              active === tab.key
                ? 'border-blue-600 font-semibold text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums text-xs text-gray-500">
              ({data[tab.key].length})
            </span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`boq-panel-${active}`}
        aria-labelledby={`boq-tab-${active}`}
        className="rounded-b-md border border-gray-200 p-3"
      >
        {active === 'unplanned' && rows.length > 0 && (
          // Said on the tab rather than in a help page: an administrator seeing 231 lines here
          // needs to know this is the ordinary state of a new tender, not a fault.
          <p className="mb-2 text-xs text-gray-500">{BOQ_COPY.unplannedExplainer}</p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">{BOQ_COPY.tabEmpty}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((item) => (
              <AlertRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AlertRow({ item }: { item: BoqItem }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <span className="text-sm text-gray-900">
        <span className="mr-2 text-xs text-gray-500 tabular-nums">{item.boqNo}</span>
        {item.taskName}
      </span>
      <span className="text-xs text-gray-600 tabular-nums">
        {item.pendingQty.toFixed(3)} {item.unit}
        {item.finishDate ? ` · ${dateLabel(item.finishDate)}` : ` · ${BOQ_COPY.unplanned}`}
      </span>
    </li>
  );
}

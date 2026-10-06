'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getBOQ } from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import BoqAlertTabs from '@/app/ui/projects/boq-alert-tabs';
import BoqEntry from '@/app/ui/projects/boq-entry';
import BoqImport from '@/app/ui/projects/boq-import';
import BoqTree from '@/app/ui/projects/boq-tree';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

type Schedule = 'contract' | 'estimate';

/**
 * The BOQ for one project (008 US5, amended 2026-10-03; split in two 2026-10-06).
 *
 * **The reason this page exists at all**: nothing in either repository could create a BOQ, so
 * 018's billing screens have been measuring against a table nothing could fill. Client bills, the
 * P&L and the monthly position were all built and all unusable.
 *
 * ## Two schedules, two tabs (027)
 *
 * Reported: a project carrying both a tender workbook and an internal estimate showed one list with
 * every section twice — "Section 2 Centering & shuttering" at (3) lines and again at (9) — and
 * nothing on screen said which was which. They are two documents about the same work answering
 * different questions: one is what the client is billed against, the other is what we expect it to
 * cost us. Interleaved, neither can be read.
 *
 * **Each import lives inside its own tab**, rather than two near-identical upload cards stacked
 * above a merged list. The old arrangement made the schedule a file lands in a property of which
 * "Choose file" you happened to click, with the two labelled only by a heading; here the schedule
 * you are looking at is the schedule you are importing into.
 *
 * Entry — Add section, Add line — appears on the contract tab only. Those routes write contract
 * scope; the estimate arrives whole, from a workbook, or not at all.
 *
 * The alerts sit below both, undivided, because they are already contract-only: `getAlerts` skips
 * every estimate group, on the grounds that a costing is not work anybody has committed to deliver.
 *
 * `PROJECTS` gates this section rather than `PROJECT_FINANCIALS`: the schedule carries rates, but
 * it is the list of what is to be built, and a site engineer who may not open a bill may certainly
 * need to read it. No `FinancialsGuard` here, unlike the billing sections next door.
 *
 * The project, its heading and its lock come from the shell layout, which fetched them once for
 * every section. This page had its own copy of all three until 2026-10-04.
 */
export default function ProjectBoqPage() {
  const { project } = useProjectShell();
  const [schedule, setSchedule] = useState<Schedule>('contract');

  // The same query key the tree uses, so the counts on the tabs and the rows under them are one
  // response rather than two that can disagree. No second request.
  const { data } = useQuery({
    queryKey: ['projects', project.id, 'boq'],
    queryFn: () => getBOQ(project.id),
  });

  const count = (estimate: boolean) =>
    (data ?? [])
      .filter((group) => group.isEstimate === estimate)
      .reduce((lines, group) => lines + group.items.length, 0);

  const tabs: { key: Schedule; label: string; lines: number }[] = [
    { key: 'contract', label: BOQ_COPY.contractTab, lines: count(false) },
    { key: 'estimate', label: BOQ_COPY.estimateTab, lines: count(true) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-gray-600">{BOQ_COPY.subheading}</p>

      <section className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label={BOQ_COPY.heading}
          className="flex flex-wrap gap-1 border-b border-gray-200"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`boq-schedule-tab-${tab.key}`}
              aria-selected={schedule === tab.key}
              aria-controls={`boq-schedule-panel-${tab.key}`}
              onClick={() => setSchedule(tab.key)}
              className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                schedule === tab.key
                  ? 'border-blue-600 font-semibold text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {/* The line count, because it is what distinguished the two duplicated sections in
                  the report and the only figure that says whether a schedule is there at all. */}
              <span className="ml-1.5 tabular-nums text-xs text-gray-500">
                ({tab.lines})
              </span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`boq-schedule-panel-${schedule}`}
          aria-labelledby={`boq-schedule-tab-${schedule}`}
          className="flex flex-col gap-6"
        >
          <p className="text-sm text-gray-600">
            {schedule === 'estimate'
              ? BOQ_COPY.estimateTabHint
              : BOQ_COPY.contractTabHint}
          </p>

          {/* 025 FR-032. The same component for both imports: they share fourteen named refusals
              and every figure, and differ only in what the confirmed rows mean — an estimate is
              not billable and does not set the quoted percentage. */}
          <BoqImport
            projectId={project.id}
            variant={schedule === 'estimate' ? 'estimate' : 'tender'}
          />

          {schedule === 'contract' && <BoqEntry projectId={project.id} />}

          <BoqTree projectId={project.id} variant={schedule} />
        </div>
      </section>

      <BoqAlertTabs projectId={project.id} />
    </div>
  );
}

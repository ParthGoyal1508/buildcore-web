'use client';

import { BOQ_COPY } from '@/app/lib/constants';
import BoqAlertTabs from '@/app/ui/projects/boq-alert-tabs';
import BoqEntry from '@/app/ui/projects/boq-entry';
import BoqImport from '@/app/ui/projects/boq-import';
import BoqTree from '@/app/ui/projects/boq-tree';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * The BOQ for one project (008 US5, amended 2026-10-03).
 *
 * **The reason this page exists at all**: nothing in either repository could create a BOQ, so
 * 018's billing screens have been measuring against a table nothing could fill. Client bills, the
 * P&L and the monthly position were all built and all unusable.
 *
 * Import above entry above the schedule, in that order. A tender arrives as a file far more often
 * than it arrives line by line, so the import is what somebody is looking for on a project with no
 * BOQ — and the schedule below is what they check immediately afterwards.
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

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-gray-600">{BOQ_COPY.subheading}</p>
      <BoqImport projectId={project.id} />
      {/* 025 FR-032. The same component: the two imports share fourteen named refusals and every
          figure, and differ only in what the confirmed rows mean — an estimate is not billable and
          does not set the quoted percentage. The endpoints have existed since 008 with no screen. */}
      <BoqImport projectId={project.id} variant="estimate" />
      <BoqEntry projectId={project.id} />
      <BoqTree projectId={project.id} />
      <BoqAlertTabs projectId={project.id} />
    </div>
  );
}

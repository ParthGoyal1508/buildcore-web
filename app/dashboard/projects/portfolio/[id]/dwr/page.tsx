'use client';

import DwrPanel from '@/app/ui/projects/dwr-panel';
import DwrReconciliation from '@/app/ui/projects/dwr-reconciliation';
import SectionGuard from '@/app/ui/projects/section-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Every daily work report on a project (feature 022, 024 Story 1 and 2).
 *
 * Guarded on `DWR` rather than `PROJECTS`: recording and approving a day's work is its own
 * permission, and the backend guards all fourteen of its routes with it.
 */
export default function ProjectDwrPage() {
  const { project } = useProjectShell();

  return (
    <SectionGuard permission="DWR">
      <div className="flex flex-col gap-10">
        <DwrPanel projectId={project.id} />
        {/* 025 FR-027. The report and its repair have existed since 022 and no screen called
            either, so a counter that drifted stayed drifted until a month-end found it. */}
        <DwrReconciliation projectId={project.id} />
      </div>
    </SectionGuard>
  );
}

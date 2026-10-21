'use client';

import { useParams } from 'next/navigation';
import DwrPanel from '@/app/ui/projects/dwr-panel';
import DwrReconciliation from '@/app/ui/projects/dwr-reconciliation';
import SectionGuard from '@/app/ui/projects/section-guard';

/**
 * Every daily work report on a project (feature 022, 024 Story 1 and 2).
 *
 * Guarded on `DWR` rather than `PROJECTS`: recording and approving a day's work is its own
 * permission, and the backend guards all fourteen of its routes with it.
 */
export default function ProjectDwrPage() {
  // The id from the route, not `useProjectShell()`: the DWR-only shell (039) has no project
  // aggregate to provide, because a holder of `DWR` alone may not read it.
  const projectId = useParams<{ id: string }>().id;

  return (
    <SectionGuard permission="DWR">
      <div className="flex flex-col gap-10">
        <DwrPanel projectId={projectId} />
        {/* 025 FR-027. The report and its repair have existed since 022 and no screen called
            either, so a counter that drifted stayed drifted until a month-end found it. */}
        <DwrReconciliation projectId={projectId} />
      </div>
    </SectionGuard>
  );
}

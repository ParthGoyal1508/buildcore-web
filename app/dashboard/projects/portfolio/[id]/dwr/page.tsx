'use client';

import DwrPanel from '@/app/ui/projects/dwr-panel';
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
      <DwrPanel projectId={project.id} />
    </SectionGuard>
  );
}

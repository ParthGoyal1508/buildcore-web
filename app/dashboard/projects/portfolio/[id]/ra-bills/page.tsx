'use client';

import FinancialsGuard from '@/app/ui/projects/financials-guard';
import RaBillsPanel from '@/app/ui/projects/ra-bills-panel';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/** Subcontractor bills measured against a work order's award (018 US2 — `bugs.md` item 12). */
export default function ProjectRaBillsPage() {
  const { project } = useProjectShell();

  return (
    <FinancialsGuard>
      <RaBillsPanel projectId={project.id} />
    </FinancialsGuard>
  );
}

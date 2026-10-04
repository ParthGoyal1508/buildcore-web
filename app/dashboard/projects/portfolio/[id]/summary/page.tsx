'use client';

import FinancialsGuard from '@/app/ui/projects/financials-guard';
import ProjectSummary from '@/app/ui/projects/project-summary';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/** One project's revenue, cost, budget and labour for a month (018 US3 — `bugs.md` items 11, 14). */
export default function ProjectSummaryPage() {
  const { project } = useProjectShell();

  return (
    <FinancialsGuard>
      <ProjectSummary projectId={project.id} projectName={project.name} />
    </FinancialsGuard>
  );
}

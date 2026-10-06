'use client';

import ProjectLetters from '@/app/ui/projects/project-letters';
import SectionGuard from '@/app/ui/projects/section-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Letters issued on a project (025 FR-033).
 *
 * Guarded on `PROJECT_FINANCIALS`, matching the backend: the three kinds here —
 * work order, letter of intent, purchase order — are mapped to that permission rather than
 * `PROJECTS` because issuing a work order is a spending decision, not a project read.
 */
export default function ProjectLettersPage() {
  const { project } = useProjectShell();

  return (
    <SectionGuard permission="PROJECT_FINANCIALS">
      <ProjectLetters projectId={project.id} />
    </SectionGuard>
  );
}

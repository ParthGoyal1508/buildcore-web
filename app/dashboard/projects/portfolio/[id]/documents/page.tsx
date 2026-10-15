'use client';

import ProjectDocumentsPanel from '@/app/ui/projects/project-documents-panel';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * One project's papers (017 US2 T014, FR-024 T077/T078).
 *
 * A section of its own rather than part of the edit form, because reading what a project holds
 * and changing what the project *is* are different jobs with different audiences — and the edit
 * form is behind the project lock, which has nothing to do with whether somebody may look at a
 * filed document.
 */
export default function ProjectDocumentsPage() {
  const { project } = useProjectShell();

  return (
    <div className="flex flex-col gap-8">
      <ProjectDocumentsPanel projectId={project.id} />
      {/* Letters were listed here too until 2026-10-15; they have their own Letters tab, and the
          client asked for them to be shown once. */}
    </div>
  );
}

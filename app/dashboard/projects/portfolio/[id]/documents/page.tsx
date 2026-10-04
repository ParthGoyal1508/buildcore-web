'use client';

import SubjectLetters from '@/app/ui/letters/subject-letters';
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
      {/*
        017 US6 (T029). On the same screen as the project's documents rather than a section of
        its own: both answer "what paperwork exists for this project", and the client's item 18
        asks for letters to be reachable from the project module. The subject pair is how a letter
        names a project — `project`/`:id` — and this app never resolves it.
      */}
      <SubjectLetters query={{ subjectType: 'project', subjectId: project.id }} />
    </div>
  );
}

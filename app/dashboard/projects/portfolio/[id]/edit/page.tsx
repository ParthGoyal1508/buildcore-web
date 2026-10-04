'use client';

import ProjectForm from '@/app/ui/projects/project-form';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Edit a project, including its lock (spec US3, FR-003).
 *
 * The locked banner and the lock context both moved up to the shell layout: the lock governs
 * every section, not this one, and a banner that appeared only here meant a BOQ whose every save
 * would 423 said nothing about why. The form stays editable while locked on purpose — unlocking
 * *is* a write to the project.
 */
export default function EditProjectPage() {
  const { project } = useProjectShell();

  return <ProjectForm project={project} />;
}

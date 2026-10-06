'use client';

import DwrForm from '@/app/ui/projects/dwr-form';
import SectionGuard from '@/app/ui/projects/section-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/** Recording a day's work (024 Story 1). No field here accepts a computed quantity. */
export default function NewDwrPage() {
  const { project } = useProjectShell();

  return (
    <SectionGuard permission="DWR">
      <DwrForm projectId={project.id} />
    </SectionGuard>
  );
}

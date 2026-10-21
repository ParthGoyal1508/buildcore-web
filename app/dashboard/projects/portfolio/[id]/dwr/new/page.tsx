'use client';

import { useParams } from 'next/navigation';
import DwrForm from '@/app/ui/projects/dwr-form';
import SectionGuard from '@/app/ui/projects/section-guard';

/** Recording a day's work (024 Story 1). No field here accepts a computed quantity. */
export default function NewDwrPage() {
  // The id from the route, not `useProjectShell()`: the DWR-only shell (039) has no project
  // aggregate to provide, because a holder of `DWR` alone may not read it.
  const projectId = useParams<{ id: string }>().id;

  return (
    <SectionGuard permission="DWR">
      <DwrForm projectId={projectId} />
    </SectionGuard>
  );
}

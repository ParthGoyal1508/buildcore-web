'use client';

import BillPackagesPanel from '@/app/ui/projects/bill-packages-panel';
import FinancialsGuard from '@/app/ui/projects/financials-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Running-account bill packages on a project (feature 023, 024 Story 3).
 *
 * Distinct from the two sections beside it: those are 018's single client and subcontractor bills,
 * and this is the 24-sheet package the client actually sends — check list, abstract, priced
 * schedule, a measurement sheet per item, and the debit register.
 */
export default function ProjectBillPackagesPage() {
  const { project } = useProjectShell();

  return (
    <FinancialsGuard>
      <BillPackagesPanel projectId={project.id} />
    </FinancialsGuard>
  );
}

'use client';

import BillPackageReports from '@/app/ui/projects/bill-package-reports';
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
      <div className="flex flex-col gap-10">
        <BillPackagesPanel projectId={project.id} />
        {/* 025 FR-031. Both reports exist because 023's decisions oblige them — a reason nobody
            aggregates is a reason nobody reads — and neither had a caller. */}
        <BillPackageReports projectId={project.id} />
      </div>
    </FinancialsGuard>
  );
}

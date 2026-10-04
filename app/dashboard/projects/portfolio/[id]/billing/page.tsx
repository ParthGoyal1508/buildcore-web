'use client';

import BillSheet from '@/app/ui/projects/bill-sheet';
import ClientBillsList from '@/app/ui/projects/client-bills-list';
import FinancialsGuard from '@/app/ui/projects/financials-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Client bills for one project (018 US1 — `bugs.md` item 11).
 *
 * The sheet above and the history below, on one screen deliberately: the cumulative quantity a
 * biller measures against comes from the bills beneath it, and splitting them across two pages would
 * mean checking one against the other from memory.
 *
 * `FinancialsGuard` stays even though the shell's tab strip already withholds this tab from a
 * caller without `PROJECT_FINANCIALS`. The two do different jobs: the strip stops the tab being
 * offered, this explains the refusal to somebody who arrives by URL or by an old bookmark.
 */
export default function ProjectBillingPage() {
  const { project } = useProjectShell();

  return (
    <FinancialsGuard>
      <div className="flex flex-col gap-10">
        <BillSheet projectId={project.id} />
        <ClientBillsList projectId={project.id} />
      </div>
    </FinancialsGuard>
  );
}

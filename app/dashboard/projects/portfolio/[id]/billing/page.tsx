'use client';

import ClientBillsPanel from '@/app/ui/projects/client-bills-panel';
import FinancialsGuard from '@/app/ui/projects/financials-guard';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/**
 * Client bills for one project (018 US1 — `bugs.md` item 11).
 *
 * The bills and the composing sheet stay on one screen, because the cumulative quantity a biller
 * measures against comes from the bills already raised and splitting them across two pages would
 * mean checking one against the other from memory. What changed in 027 is the arrangement: they
 * were stacked, so the page opened on 231 editable rows and the bills were below them. They are
 * now master and detail — see `client-bills-panel.tsx`.
 *
 * `FinancialsGuard` stays even though the shell's tab strip already withholds this tab from a
 * caller without `PROJECT_FINANCIALS`. The two do different jobs: the strip stops the tab being
 * offered, this explains the refusal to somebody who arrives by URL or by an old bookmark.
 */
export default function ProjectBillingPage() {
  const { project } = useProjectShell();

  return (
    <FinancialsGuard>
      <ClientBillsPanel projectId={project.id} />
    </FinancialsGuard>
  );
}

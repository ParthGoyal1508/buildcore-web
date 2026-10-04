'use client';

import PageHeader from '@/app/ui/page-header';
import PnlBoard from '@/app/ui/dashboard/pnl-board';

/**
 * Every project's position, with the company total (018 US4 — `bugs.md` item 11).
 *
 * A `/dashboard/projects/pnl` section rather than a dashboard widget: it is a screen somebody opens
 * to answer a question, not a tile they glance at, and `PROJECTS_PERMISSIONS.pnl` gates it on
 * `PROJECT_FINANCIALS` through the projects layout.
 */
export default function PnlBoardPage() {
  return (
    <main>
      <PageHeader title="Project P&L" className="mb-6" />
      <PnlBoard />
    </main>
  );
}

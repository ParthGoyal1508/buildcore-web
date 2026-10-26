import type { Metadata } from 'next';
import { Suspense } from 'react';

import ReimbursementsWorkspace from '@/app/ui/hr/reimbursements-workspace';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Reimbursements' };

export default function ReimbursementsPage() {
  return (
    <main>
      <PageHeader title="Reimbursements" className="mb-6" />
      {/* The view and the queue's filters live in the URL (036 F17), which reads useSearchParams. */}
      <Suspense>
        <ReimbursementsWorkspace />
      </Suspense>
    </main>
  );
}

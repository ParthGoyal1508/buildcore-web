import type { Metadata } from 'next';
import { Suspense } from 'react';

import ReimbursementsAdminTable from '@/app/ui/hr/reimbursements-admin-table';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Reimbursements' };

export default function ReimbursementsPage() {
  return (
    <main>
      <PageHeader title="Reimbursement claims" className="mb-6" />
      {/* Filters live in the URL (036 F17), which reads useSearchParams. */}
      <Suspense>
        <ReimbursementsAdminTable />
      </Suspense>
    </main>
  );
}

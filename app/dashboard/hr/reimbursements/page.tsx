import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import ReimbursementsAdminTable from '@/app/ui/hr/reimbursements-admin-table';

export const metadata: Metadata = { title: 'Reimbursements' };

export default function ReimbursementsPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Reimbursement claims</h1>
      <ReimbursementsAdminTable />
    </main>
  );
}

import type { Metadata } from 'next';

import LoansTable from '@/app/ui/hr/loans-table';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Loans' };

export default function LoansPage() {
  return (
    <main>
      <PageHeader title="Loans" className="mb-6" />
      <LoansTable />
    </main>
  );
}

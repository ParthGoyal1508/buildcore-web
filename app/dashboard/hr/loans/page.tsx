import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import LoansTable from '@/app/ui/hr/loans-table';

export const metadata: Metadata = { title: 'Loans' };

export default function LoansPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Loans</h1>
      <LoansTable />
    </main>
  );
}

import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import PayrollRunsTable from '@/app/ui/hr/payroll-runs-table';

export const metadata: Metadata = { title: 'Payroll' };

export default function PayrollPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Payroll</h1>
      <PayrollRunsTable />
    </main>
  );
}

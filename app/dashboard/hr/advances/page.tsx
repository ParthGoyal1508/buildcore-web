import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import SalaryAdvancesTable from '@/app/ui/hr/salary-advances-table';

export const metadata: Metadata = { title: 'Salary Advances' };

export default function AdvancesPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Salary Advances</h1>
      <p className="mb-6 text-sm text-gray-600">
        Recovered in full from the nominated payroll run — unlike a loan, which is
        repaid over an EMI schedule.
      </p>
      <SalaryAdvancesTable />
    </main>
  );
}

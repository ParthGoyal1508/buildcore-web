import type { Metadata } from 'next';

import SalaryAdvancesTable from '@/app/ui/hr/salary-advances-table';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Salary Advances' };

export default function AdvancesPage() {
  return (
    <main>
      <PageHeader
        title="Salary Advances"
        description="Recovered in full from the nominated payroll run — unlike a loan, which is repaid over an EMI schedule."
        className="mb-6"
      />
      <SalaryAdvancesTable />
    </main>
  );
}

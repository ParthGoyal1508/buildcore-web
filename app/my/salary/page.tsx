import type { Metadata } from 'next';
import SalarySlipPanel from '@/app/ui/my/salary-slip';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Salary' };

export default function MySalaryPage() {
  return (
    <main>
      <PageHeader title="My Salary" className="mb-4" />
      <SalarySlipPanel />
    </main>
  );
}

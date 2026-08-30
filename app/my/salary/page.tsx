import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import SalarySlipPanel from '@/app/ui/my/salary-slip';

export const metadata: Metadata = { title: 'Salary' };

export default function MySalaryPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-2xl`}>My Salary</h1>
      <SalarySlipPanel />
    </main>
  );
}

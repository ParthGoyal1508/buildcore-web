import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import HrSectionGrid from '@/app/ui/hr/section-grid';

export const metadata: Metadata = { title: 'HR & Payroll' };

export default function HrPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>HR &amp; Payroll</h1>
      <p className="mb-6 text-sm text-gray-600">
        Employee records, attendance, leave, payroll and statutory filings.
      </p>
      <HrSectionGrid />
    </main>
  );
}

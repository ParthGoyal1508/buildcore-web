import type { Metadata } from 'next';

import HrSectionGrid from '@/app/ui/hr/section-grid';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'HR & Payroll' };

export default function HrPage() {
  return (
    <main>
      <PageHeader
        title="HR & Payroll"
        description="Employee records, attendance, leave, payroll and statutory filings."
        className="mb-6"
      />
      <HrSectionGrid />
    </main>
  );
}

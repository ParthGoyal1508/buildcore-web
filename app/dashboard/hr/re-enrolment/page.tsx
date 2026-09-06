import type { Metadata } from 'next';

import ReEnrolmentTable from '@/app/ui/hr/re-enrolment-table';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Biometric re-enrolment' };

export default function ReEnrolmentPage() {
  return (
    <main>
      <PageHeader
        title="Biometric re-enrolment"
        description="Approving opens a time-limited window for the employee to re-enrol. An approval that is not used before it expires simply lapses."
        className="mb-6"
      />
      <ReEnrolmentTable />
    </main>
  );
}

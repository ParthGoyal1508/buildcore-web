import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import ReEnrolmentTable from '@/app/ui/hr/re-enrolment-table';

export const metadata: Metadata = { title: 'Biometric re-enrolment' };

export default function ReEnrolmentPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>
        Biometric re-enrolment
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Approving opens a time-limited window for the employee to re-enrol. An
        approval that is not used before it expires simply lapses.
      </p>
      <ReEnrolmentTable />
    </main>
  );
}

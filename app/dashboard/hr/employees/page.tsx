import type { Metadata } from 'next';
import { Suspense } from 'react';

import EmployeeList from '@/app/ui/hr/employee-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Employees' };

export default function EmployeesPage() {
  return (
    <main>
      <PageHeader title="Employees" className="mb-6" />
      {/* The list keeps its filters in the URL (036 F12), which reads useSearchParams. */}
      <Suspense>
        <EmployeeList />
      </Suspense>
    </main>
  );
}

import type { Metadata } from 'next';

import EmployeeList from '@/app/ui/hr/employee-list';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Employees' };

export default function EmployeesPage() {
  return (
    <main>
      <PageHeader title="Employees" className="mb-6" />
      <EmployeeList />
    </main>
  );
}

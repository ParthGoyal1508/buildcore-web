import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import EmployeeList from '@/app/ui/hr/employee-list';

export const metadata: Metadata = { title: 'Employees' };

export default function EmployeesPage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Employees</h1>
      <EmployeeList />
    </main>
  );
}

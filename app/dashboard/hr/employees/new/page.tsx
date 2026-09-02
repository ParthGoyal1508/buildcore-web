import type { Metadata } from 'next';

import { lusitana } from '@/app/ui/fonts';
import EmployeeForm from '@/app/ui/hr/employee-form';

export const metadata: Metadata = { title: 'Add employee' };

export default function NewEmployeePage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Add employee</h1>
      <p className="mb-4 text-sm text-gray-600">
        The employee code is allocated from the company series on save.
      </p>
      <EmployeeForm />
    </main>
  );
}

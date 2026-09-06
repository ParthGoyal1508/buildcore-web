import type { Metadata } from 'next';

import EmployeeForm from '@/app/ui/hr/employee-form';
import PageHeader from '@/app/ui/page-header';

export const metadata: Metadata = { title: 'Add employee' };

export default function NewEmployeePage() {
  return (
    <main>
      <PageHeader
        title="Add employee"
        description="The employee code is allocated from the company series on save."
        className="mb-4"
      />
      <EmployeeForm />
    </main>
  );
}

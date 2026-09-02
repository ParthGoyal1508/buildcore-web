import type { Metadata } from 'next';

import EmployeeEditor from '@/app/ui/hr/employee-editor';

export const metadata: Metadata = { title: 'Edit employee' };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeEditor employeeId={id} />;
}

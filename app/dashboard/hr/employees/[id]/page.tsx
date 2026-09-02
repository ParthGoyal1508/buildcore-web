import type { Metadata } from 'next';

import EmployeeDetailTabs from '@/app/ui/hr/employee-detail-tabs';

export const metadata: Metadata = { title: 'Employee' };

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeDetailTabs employeeId={id} />;
}

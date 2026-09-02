'use client';

import { useQuery } from '@tanstack/react-query';

import { getEmployee } from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import EmployeeForm from '@/app/ui/hr/employee-form';

/**
 * Loads the record the edit form starts from.
 *
 * A client boundary rather than a server fetch because the access token is held in
 * memory (feature 001) — a server component has no way to authenticate this call.
 */
export default function EmployeeEditor({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: () => getEmployee(employeeId),
  });

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {HR_MESSAGES.employeeLoadFailed}
      </p>
    );
  }

  const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();

  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>
        {name || data.employeeCode}
      </h1>
      <p className="mb-4 text-sm text-gray-600">{data.employeeCode}</p>
      <EmployeeForm employee={data} />
    </main>
  );
}

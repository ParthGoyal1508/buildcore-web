'use client';

import { useQuery } from '@tanstack/react-query';

import { listEmployees } from '@/app/lib/api/hr-payroll';

/**
 * Resolves an `employeeId` to something a person can read.
 *
 * Several HR endpoints return the raw row and so carry only `employeeId` — the
 * leave list, the exception queue, the modification trail and the claims list all
 * do. Rendering a cuid in an "Employee" column is not an option, and having each
 * table fetch and join the roster itself would mean four copies of the same
 * lookup drifting apart.
 *
 * One shared query key, so the roster is fetched once and reused across every
 * table on the page rather than once per table.
 */
export function useEmployeeNames() {
  const { data } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const byId = new Map(
    (data?.items ?? []).map((employee) => {
      const name = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return [
        employee.id,
        { code: employee.employeeCode, name: name || employee.employeeCode },
      ];
    }),
  );

  return {
    /** "BCD-0002 · Asha Patel", or the bare id if the roster hasn't loaded. */
    label(employeeId: string): string {
      const found = byId.get(employeeId);
      if (!found) return employeeId;
      return found.name === found.code
        ? found.code
        : `${found.code} · ${found.name}`;
    },
    code: (employeeId: string) => byId.get(employeeId)?.code ?? employeeId,
  };
}

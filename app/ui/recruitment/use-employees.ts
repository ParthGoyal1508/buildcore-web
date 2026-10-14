'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { EMPLOYEE_PAGE_MAX, listEmployees } from '@/app/lib/api/hr-payroll';

/**
 * Active employees by id, as "Name (code)" (2026-10-14). An interview names its panel by employee
 * id, and every screen here printed the id: the scheduler asked for ids typed comma-separated, and
 * feedback was given "as" `cmv801cow00sqxfl57wjr6xfa`. One read, shared by the three places.
 */
export function useEmployees() {
  const query = useQuery({
    queryKey: ['employees', 'interviewers'],
    queryFn: () => listEmployees({ isActive: true, pageSize: EMPLOYEE_PAGE_MAX }),
    staleTime: 5 * 60_000,
  });
  const people = useMemo(
    () =>
      (query.data?.items ?? [])
        .map((e) => ({
          id: e.id,
          name:
            [e.firstName, e.lastName].filter(Boolean).join(' ') || e.employeeCode,
          code: e.employeeCode,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  // An interviewer who has since left is not in the active list; their id is still better than
  // a blank, and is what the record holds.
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  return { people, nameOf, isError: query.isError, isLoading: query.isLoading };
}

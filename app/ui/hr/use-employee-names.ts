'use client';

import { useQuery } from '@tanstack/react-query';

import { listEmployees } from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES } from '@/app/lib/constants';

/**
 * Resolves an `employeeId` to something a person can read.
 *
 * Several HR endpoints return the raw row and so carry only `employeeId` — the
 * exception queue, the modification trail, the loans list and the claims list all
 * do. Rendering a cuid in an "Employee" column is not an option, and having each
 * table fetch and join the roster itself would mean four copies of the same
 * lookup drifting apart.
 *
 * One shared query key, so the roster is fetched once and reused across every
 * table on the page rather than once per table.
 *
 * **This is the fallback, not the preferred answer.** The leave queue used to resolve
 * names here and now receives `employeeName` from the server (api `employee-name.ts`),
 * which is correct for three reasons this hook cannot fix: the roster request can fail,
 * the roster is one page of a hundred, and an employee outside the caller's scope is
 * not in it at all. Every endpoint that lists rows about people should send the name;
 * until each one does, this stands in — and says so rather than rendering an id.
 */
export function useEmployeeNames() {
  const { data, isPending, isError } = useQuery({
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

  /**
   * The three ways a lookup ends, kept apart.
   *
   * The id is never one of them. It used to be the fallback for all three, which is how
   * `cmu40n3au005b123nmjopcv79` came to sit in a column headed "Employee" — and because
   * it looked like a value rather than an absence, it read as the product displaying the
   * wrong field rather than as a request that had failed.
   */
  const missing = () =>
    isPending
      ? HR_MESSAGES.employeeNameLoading
      : HR_MESSAGES.employeeNameUnavailable;

  return {
    /** Whether the roster itself failed, for a caller that wants to say so once. */
    isError,
    /** "BCD-0002 · Asha Patel", or an honest marker — never the id. */
    label(employeeId: string): string {
      const found = byId.get(employeeId);
      if (!found) return missing();
      return found.name === found.code
        ? found.code
        : `${found.code} · ${found.name}`;
    },
    code: (employeeId: string) => byId.get(employeeId)?.code ?? missing(),
    /**
     * The roster as select options, sorted by the label a reader sees (016 T054).
     *
     * Sorted by label rather than by employee code, because the person choosing is looking for a
     * name. Exposed here rather than rebuilt by each caller so the ordering cannot differ between
     * two filters on the same screen.
     */
    options: [...byId.entries()]
      .map(([id, found]) => ({
        id,
        label:
          found.name === found.code
            ? found.code
            : `${found.code} · ${found.name}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

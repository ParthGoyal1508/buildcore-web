import { listEmployees, EMPLOYEE_PAGE_MAX } from '@/app/lib/api/hr-payroll';
import { getClients, getProjects } from '@/app/lib/api/projects';
import type { AsyncSearchPage } from '@/app/ui/async-select';

/**
 * Server searches for the projects module's `AsyncSelect`s (036 I22).
 *
 * The client, project-manager and project selects loaded one page of 200 (100 for employees — the
 * endpoint's maximum) and showed what came back, so the 201st client simply did not exist in the
 * project form. Each picker now asks the server as you type, and says how many match.
 */
const PAGE = 25;

/** Clients by name. `status` narrows to active ones for a new assignment. */
export const searchClients =
  (status?: 'active') =>
  async (term: string, page: number): Promise<AsyncSearchPage> => {
    const result = await getClients({
      search: term || undefined,
      status,
      page,
      pageSize: PAGE,
    });
    return {
      items: result.items.map((client) => ({
        id: client.id,
        label: client.name,
        ...(client.status !== 'active' ? { note: client.status } : {}),
      })),
      total: result.total,
    };
  };

/** Active employees by name or code, labelled as the old select labelled them. */
export async function searchEmployees(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  const result = await listEmployees({
    search: term || undefined,
    isActive: true,
    page,
    pageSize: Math.min(PAGE, EMPLOYEE_PAGE_MAX),
  });
  return {
    items: result.items.map((employee) => ({
      id: employee.id,
      label: employeeName(employee),
      note: employee.employeeCode,
    })),
    total: result.total,
  };
}

/** Projects by name or code. */
export async function searchProjects(
  term: string,
  page: number,
): Promise<AsyncSearchPage> {
  const result = await getProjects({
    search: term || undefined,
    page,
    pageSize: PAGE,
  });
  return {
    items: result.items.map((project) => ({
      id: project.id,
      label: project.name,
      note: project.code,
    })),
    total: result.total,
  };
}

export function employeeName(employee: {
  firstName: string | null;
  lastName: string | null;
  employeeCode: string;
}): string {
  return (
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.employeeCode
  );
}

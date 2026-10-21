'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  EMPLOYEE_PAGE_MAX,
  listEmployees,
  listSites,
  type Employee,
} from '@/app/lib/api/hr-payroll';
import { listDepartments, listDesignations } from '@/app/lib/api/settings';
import {
  EMPLOYEE_PAGE_SIZE,
  HR_MESSAGES,
  LOCATION_ASSIGNMENT,
  ROUTES,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlSort,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { downloadCsv } from '@/app/ui/hr/csv';
import { useToast } from '@/app/ui/toast';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import {
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import BulkLocationAssignment from '@/app/ui/hr/bulk-location-assignment';
import { NocStatusBadge, useNocStatuses } from '@/app/ui/nocs/noc-status';

/** Falls back to the code when an employee has no name recorded yet. */
function displayName(employee: Employee): string {
  const full = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || employee.employeeCode;
}

const STATUSES = ['active', 'inactive'] as const;
/** The columns the server can order by (036 F12); the rest are not sortable. */
const SERVER_SORT: Record<string, string> = { code: 'code', name: 'name', joining: 'joining' };

/**
 * 036 F12: filters, search, page and sort live in the URL, so Back from an employee returns to the
 * same filtered page and a filtered list can be sent as a link; search waits for typing to pause;
 * the sort is the server's (header sort used to reorder only the 25 rows on screen); Export CSV
 * writes every employee matching the filters, not just this page.
 */
export default function EmployeeList() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const toast = useToast();
  const [ui, setUi, url] = useUrlState(
    {
      q: urlString(),
      department: urlString(),
      site: urlString(),
      status: urlEnum(STATUSES, 'active'),
      page: urlNumber(1),
      sort: urlSort({ key: 'code', dir: 'asc' }),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  const page = url.page;

  const filters = useMemo(
    () => ({
      search: url.q.trim() || undefined,
      departmentId: url.department || undefined,
      siteId: url.site || undefined,
      isActive: url.status === 'active',
      sort: url.sort ? `${SERVER_SORT[url.sort.key] ?? 'code'}:${url.sort.dir}` : undefined,
    }),
    [url.q, url.department, url.site, url.status, url.sort],
  );

  const employees = useQuery({
    queryKey: ['hr', 'employees', filters, page],
    queryFn: () =>
      listEmployees({ ...filters, page, pageSize: EMPLOYEE_PAGE_SIZE }),
    // Keeps the previous page on screen while the next one loads, so paging
    // doesn't flash an empty table between every click.
    placeholderData: keepPreviousData,
  });
  const { data } = employees;

  const exportCsv = useMutation({
    mutationFn: async () => {
      const rows: Employee[] = [];
      for (let p = 1; ; p += 1) {
        const batch = await listEmployees({ ...filters, page: p, pageSize: EMPLOYEE_PAGE_MAX });
        rows.push(...batch.items);
        if (rows.length >= batch.total || batch.items.length === 0) break;
      }
      return rows;
    },
    onSuccess: (rows) =>
      downloadCsv(
        `Employees_${url.status}.csv`,
        ['Code', 'Name', 'Department', 'Designation', 'Site', 'Mobile', 'Joined', 'Status'],
        rows.map((row) => [
          row.employeeCode,
          displayName(row),
          departmentName(row.departmentId),
          designationName(row.designationId),
          siteName(row.siteId),
          row.mobile ?? '',
          row.dateOfJoining ? dateLabel(row.dateOfJoining) : '',
          row.isActive ? 'Active' : 'Inactive',
        ]),
      ),
    onError: (err) => toast.error(errorMessage(err, 'Could not export the employees.')),
  });
  // Open until the employee's NOC is uploaded, then closed (2026-10-17). Paged on the server, so
  // a column only — a filter here would filter the page on screen, not the register.
  const nocStatuses = useNocStatuses(
    'employee',
    (data?.items ?? []).map((row) => row.id),
  );

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const { data: designations } = useQuery({
    queryKey: ['designations'],
    queryFn: () => listDesignations(),
  });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });

  const departmentName = (id: string | null) =>
    departments?.find((d) => d.id === id)?.name ?? '—';
  const designationName = (id: string | null) =>
    designations?.find((d) => d.id === id)?.name ?? '—';
  const siteName = (id: string) => sites?.find((s) => s.id === id)?.name ?? '—';

  const columns: Column<Employee>[] = [
    {
      key: 'code',
      header: 'Code',
      sticky: true,
      render: (row) => (
        <Link
          href={ROUTES.hrEmployee(row.id)}
          className="font-medium text-brand-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {row.employeeCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', render: displayName },
    {
      key: 'department',
      header: 'Department',
      sortable: false,
      render: (row) => departmentName(row.departmentId),
    },
    {
      key: 'designation',
      header: 'Designation',
      sortable: false,
      render: (row) => designationName(row.designationId),
    },
    { key: 'site', header: 'Site', sortable: false, render: (row) => siteName(row.siteId) },
    { key: 'mobile', header: 'Mobile', sortable: false, render: (row) => row.mobile ?? '—' },
    {
      key: 'joining',
      header: 'Joined',
      render: (row) => (row.dateOfJoining ? dateLabel(row.dateOfJoining) : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: false,
      render: (row) => (
        <StatusBadge status={row.isActive ? 'active' : 'closed'} />
      ),
    },
    {
      key: 'noc',
      header: 'NOC',
      sortable: false,
      render: (row) => <NocStatusBadge status={nocStatuses?.get(row.id)} />,
    },
  ];

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-[min(100%,40rem)] flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="employee-search"
            label="Search"
            placeholder="Code or name"
            type="search"
            value={ui.q}
            onChange={(event) => setUi({ q: event.target.value })}
          />
          <SelectField
            id="employee-department"
            label="Department"
            value={ui.department}
            onChange={(event) => setUi({ department: event.target.value })}
          >
            <option value="">All departments</option>
            {departments?.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="employee-site"
            label="Site"
            value={ui.site}
            onChange={(event) => setUi({ site: event.target.value })}
          >
            <option value="">All sites</option>
            {sites?.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="employee-status"
            label="Status"
            value={ui.status}
            onChange={(event) =>
              setUi({ status: event.target.value as 'active' | 'inactive' })
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 020 FR-010. Beside the filters rather than on a screen of its own: "a site's staff"
              is already expressible here, and a second employee picker would be a second place
              for the two to disagree about who counts. */}
          <SecondaryButton
            type="button"
            loading={exportCsv.isPending}
            disabled={!data?.total}
            onClick={() => exportCsv.mutate()}
          >
            Export CSV
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setBulkOpen(true)}>
            {LOCATION_ASSIGNMENT.bulkHeading}
          </SecondaryButton>
          {/* 036: a screen of its own, unlike the location dialog beside it — a Day/Night
              rotation moves whole crews across every page of this list, not the 25 on screen. */}
          <Link href={ROUTES.hrEmployeesBulkShift}>
            <SecondaryButton type="button">Change Shifts</SecondaryButton>
          </Link>
          <Link href={`${ROUTES.hrEmployees}/new`}>
            <Button type="button">
              <PlusIcon className="mr-2 w-4" aria-hidden="true" />
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      <DataTable
        caption="Employees"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={employees.isPending}
        error={employees.isError ? employees.error : null}
        onRetry={() => employees.refetch()}
        serverPaged
        sort={url.sort}
        onSortChange={(sort) => setUi({ sort })}
        isRefreshing={employees.isPlaceholderData}
        emptyMessage={HR_MESSAGES.noEmployees}
      />

      {total > EMPLOYEE_PAGE_SIZE && (
        <nav
          className="flex items-center justify-between text-sm"
          aria-label="Employee list pages"
        >
          <p className="text-gray-600">
            Page {page} of {lastPage} · {total} employees
          </p>
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => setUi({ page: Math.max(1, page - 1) })}
              disabled={page === 1}
            >
              Previous
            </SecondaryButton>
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => setUi({ page: Math.min(lastPage, page + 1) })}
              disabled={page >= lastPage}
            >
              Next
            </SecondaryButton>
          </div>
        </nav>
      )}

      {/* The page the administrator is looking at, not every employee who matches the filter.
          Assigning people who are not on screen is how somebody assigns a site they cannot see,
          and the count in the dialog is the honest one either way. */}
      {bulkOpen && (
        <BulkLocationAssignment
          employees={(data?.items ?? []).map((employee) => ({
            id: employee.id,
            employeeCode: employee.employeeCode,
          }))}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </div>
  );
}

'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  listEmployees,
  listSites,
  type Employee,
} from '@/app/lib/api/hr-payroll';
import { listDepartments, listDesignations } from '@/app/lib/api/settings';
import {
  EMPLOYEE_PAGE_SIZE,
  HR_MESSAGES,
  MESSAGES,
  ROUTES,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

/** Falls back to the code when an employee has no name recorded yet. */
function displayName(employee: Employee): string {
  const full = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || employee.employeeCode;
}

export default function EmployeeList() {
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      departmentId: departmentId || undefined,
      siteId: siteId || undefined,
      isActive: status === 'active',
      page,
      pageSize: EMPLOYEE_PAGE_SIZE,
    }),
    [search, departmentId, siteId, status, page],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'employees', filters],
    queryFn: () => listEmployees(filters),
    // Keeps the previous page on screen while the next one loads, so paging
    // doesn't flash an empty table between every click.
    placeholderData: keepPreviousData,
  });

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
          className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {row.employeeCode}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', render: displayName },
    {
      key: 'department',
      header: 'Department',
      render: (row) => departmentName(row.departmentId),
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (row) => designationName(row.designationId),
    },
    { key: 'site', header: 'Site', render: (row) => siteName(row.siteId) },
    { key: 'mobile', header: 'Mobile', render: (row) => row.mobile ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.isActive ? 'active' : 'closed'} />,
    },
  ];

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / EMPLOYEE_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            id="employee-search"
            label="Search"
            placeholder="Code or name"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <SelectField
            id="employee-department"
            label="Department"
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setPage(1);
            }}
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
            value={siteId}
            onChange={(event) => {
              setSiteId(event.target.value);
              setPage(1);
            }}
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
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'active' | 'inactive');
              setPage(1);
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
        </div>
        <Link href={`${ROUTES.hrEmployees}/new`}>
          <Button type="button">
            <PlusIcon className="mr-2 w-4" aria-hidden="true" />
            Add Employee
          </Button>
        </Link>
      </div>

      <DataTable
        caption="Employees"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
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
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-200 px-3 py-1.5 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
              disabled={page >= lastPage}
              className="rounded-md border border-gray-200 px-3 py-1.5 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getLeaveBalances, listEmployees } from '@/app/lib/api/hr-payroll';
import { MESSAGES, hrLabel } from '@/app/lib/constants';
import { money } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField } from '@/app/ui/settings/form-fields';

type BalanceRow = Awaited<ReturnType<typeof getLeaveBalances>>[number];

/**
 * Leave balances for one employee.
 *
 * Per-employee rather than a company-wide grid because that is what the backend
 * offers — `/hr/leave/balances` takes an `employeeId` and returns that person's
 * rows. A company-wide view would be N requests, which is a report, not a screen.
 */
export default function LeaveBalanceTable() {
  const [employeeId, setEmployeeId] = useState('');

  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'leaveBalances', employeeId],
    queryFn: () => getLeaveBalances(employeeId),
    enabled: employeeId.length > 0,
  });

  const columns: Column<BalanceRow>[] = [
    {
      key: 'type',
      header: 'Leave type',
      sticky: true,
      render: (row) => hrLabel(row.leaveType),
    },
    { key: 'fy', header: 'Financial year', render: (row) => row.financialYear },
    { key: 'opening', header: 'Opening', numeric: true, render: (row) => money(row.opening) },
    { key: 'accrued', header: 'Accrued', numeric: true, render: (row) => money(row.accrued) },
    { key: 'used', header: 'Used', numeric: true, render: (row) => money(row.used) },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      render: (row) => money(row.balance ?? row.opening + row.accrued - row.used),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-md">
        <SelectField
          id="balance-employee"
          label="Employee"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">Select an employee</option>
          {employees?.items.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.employeeCode} ·{' '}
              {[employee.firstName, employee.lastName].filter(Boolean).join(' ')}
            </option>
          ))}
        </SelectField>
      </div>

      {employeeId ? (
        <DataTable
          caption="Leave balances"
          columns={columns}
          rows={data ?? []}
          rowKey={(row) => `${row.leaveType}-${row.financialYear}`}
          isLoading={isLoading}
          error={isError ? MESSAGES.loadFailed : null}
          emptyMessage="No leave balances have been opened for this employee."
        />
      ) : (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          Choose an employee to see their leave balances.
        </p>
      )}
    </div>
  );
}

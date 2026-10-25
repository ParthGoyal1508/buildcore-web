'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getReimbursementRegister,
  listReimbursementCategories,
  type AdminClaim,
} from '@/app/lib/api/hr-payroll';
import { hrLabel } from '@/app/lib/constants';
import { dateLabel, money, periodLabel } from '@/app/lib/format';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { monthRange } from '@/app/ui/hr/reimbursements-admin-table';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

/** Drafts are excluded by the server — they belong to the employee until submitted. */
const STATUS_FILTERS = [
  'all',
  'submitted',
  'approved',
  'paid',
  'rejected',
  'withdrawn',
] as const;

/** The subtotals, in claim-lifecycle order; `all` closes the row. `withdrawn` has no subtotal
 * of its own — the server's contract — but its claims are rows and count into `all`. */
const TOTAL_KEYS = ['submitted', 'approved', 'paid', 'rejected', 'all'] as const;

/**
 * The Reimbursement Register (042): every non-draft claim, with status subtotals.
 *
 * A register, not a queue — nothing here can be approved or paid; that stays on the Claims tab,
 * where each action asks first and checks who is deciding. This answers the accounting question
 * the queue cannot: "how much is sitting at each stage for this month". The rows and the
 * subtotals come from one request, so they can never disagree.
 */
export default function ReimbursementRegister() {
  const employees = useEmployeeNames();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [month, setMonth] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const filters = {
    ...(status === 'all' ? {} : { status }),
    ...(employeeId ? { employeeId } : {}),
    ...monthRange(month),
  };

  const register = useQuery({
    // Every filter in the key, so changing one refetches rather than showing the last answer.
    queryKey: ['hr', 'reimbursementRegister', filters],
    queryFn: () => getReimbursementRegister(filters),
  });

  // The claim carries only `categoryId`; the category master supplies the name.
  const { data: categories } = useQuery({
    queryKey: ['settings', 'reimbursementCategories'],
    queryFn: listReimbursementCategories,
  });
  const categoryName = (id: string | null | undefined) =>
    (id && categories?.find((c) => c.id === id)?.name) || '—';

  const columns: Column<AdminClaim>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => categoryName(row.categoryId),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="block max-w-[18rem] whitespace-normal text-gray-700">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => money(row.amount),
    },
    {
      key: 'date',
      header: 'Expense date',
      render: (row) => dateLabel(row.expenseDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => row.adminRemarks ?? '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-3xl">
        <SelectField
          id="register-status"
          label="Status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as (typeof STATUS_FILTERS)[number])
          }
        >
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>
              {value === 'all' ? 'All statuses' : hrLabel(value)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="register-month"
          label="Expense month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          hint={month ? periodLabel(month) : 'All months'}
        />
        <SelectField
          id="register-employee"
          label="Employee"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">All employees</option>
          {employees.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      {register.data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TOTAL_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {key === 'all' ? 'All claims' : hrLabel(key)}
              </dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-gray-900">
                {money(register.data.totals[key])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <DataTable
        caption="Reimbursement register"
        columns={columns}
        rows={register.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={register.isPending}
        error={register.isError ? register.error : null}
        onRetry={() => register.refetch()}
        emptyMessage="No claims match this filter."
      />
    </div>
  );
}

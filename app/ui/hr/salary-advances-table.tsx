'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  approveSalaryAdvance,
  createSalaryAdvance,
  listEmployees,
  listSalaryAdvances,
  type SalaryAdvance,
} from '@/app/lib/api/hr-payroll';
import {
  HR_MESSAGES,
  MESSAGES,
  SALARY_ADVANCE_STATUSES,
  hrLabel,
} from '@/app/lib/constants';
import { currentPeriod, money, periodLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

function RequestAdvanceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [recoveryMonth, setRecoveryMonth] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      createSalaryAdvance({
        employeeId,
        amount: Number(amount),
        reason: reason.trim(),
        recoveryMonth,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canSubmit =
    employeeId && Number(amount) > 0 && reason.trim().length > 0 && recoveryMonth;

  return (
    <Modal
      title="Record a salary advance"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending ? 'Saving…' : 'Record advance'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        {/* Advances and loans are easy to confuse and behave completely
            differently in payroll, so the difference is stated where the choice
            is being made, not in a help page. */}
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {HR_MESSAGES.advanceDistinctFromLoan}
        </p>
        <SelectField
          id="advance-employee"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="advance-amount"
            label="Amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TextField
            id="advance-month"
            label="Recovery month"
            type="month"
            value={recoveryMonth}
            onChange={(event) => setRecoveryMonth(event.target.value)}
            hint="The whole amount is recovered from this run."
          />
        </div>
        <TextField
          id="advance-reason"
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  );
}

export default function SalaryAdvancesTable() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'advances', status],
    queryFn: () =>
      listSalaryAdvances(
        status ? { status: status as (typeof SALARY_ADVANCE_STATUSES)[number] } : {},
      ),
  });

  const approve = useMutation({
    mutationFn: approveSalaryAdvance,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] }),
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<SalaryAdvance>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.employeeName ?? row.employeeCode ?? row.employeeId,
    },
    { key: 'amount', header: 'Amount', numeric: true, render: (row) => money(row.amount) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      numeric: true,
      render: (row) => money(row.outstandingBalance ?? null),
    },
    {
      key: 'recovery',
      header: 'Recovered from',
      render: (row) => periodLabel(row.recoveryMonth),
    },
    { key: 'reason', header: 'Reason', render: (row) => row.reason },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xs flex-1">
          <SelectField
            id="advance-status"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {SALARY_ADVANCE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="button" onClick={() => setRequesting(true)}>
          Record an advance
        </Button>
      </div>

      <FormError message={error} />

      <DataTable
        caption="Salary advances"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No salary advances match this filter."
        actions={(row) =>
          row.status === 'pending' ? (
            <RowAction type="button" onClick={() => approve.mutate(row.id)}>
              Approve
            </RowAction>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )
        }
      />

      {requesting && <RequestAdvanceModal onClose={() => setRequesting(false)} />}
    </div>
  );
}

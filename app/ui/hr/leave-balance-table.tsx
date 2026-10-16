'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  adjustLeave,
  CREDITED_LEAVE_TYPES,
  getLeaveBalances,
  getLeaveLedger,
  listEmployees,
  type CreditedLeaveType,
  type LeaveLedgerEntry,
} from '@/app/lib/api/hr-payroll';
import { MESSAGES, hrLabel } from '@/app/lib/constants';
import { dateLabel, financialYearOf, periodLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/** Days, not rupees (2026-10-16 — the columns were formatted as money). */
const days = (n: number) =>
  Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

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
    {
      key: 'opening',
      header: 'Opening',
      numeric: true,
      render: (row) => days(row.opening),
    },
    {
      key: 'accrued',
      header: 'Accrued',
      numeric: true,
      render: (row) => days(row.accrued),
    },
    {
      key: 'used',
      header: 'Used',
      numeric: true,
      render: (row) => days(row.used),
    },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      render: (row) =>
        days(row.balance ?? row.opening + row.accrued - row.used),
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
              {[employee.firstName, employee.lastName]
                .filter(Boolean)
                .join(' ')}
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
      ) : null}
      {employeeId ? (
        <>
          <AdjustForm employeeId={employeeId} />
          <LeaveHistory employeeId={employeeId} />
        </>
      ) : (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          Choose an employee to see their leave balances.
        </p>
      )}
    </div>
  );
}

/** HR adds or takes away days for one employee, with a reason everyone can later read (2026-10-16). */
function AdjustForm({ employeeId }: { employeeId: string }) {
  const companyId = useSelectedCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<CreditedLeaveType>('earned');
  const [direction, setDirection] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      adjustLeave(companyId, {
        employeeId,
        leaveType,
        financialYear: financialYearOf(),
        days: (direction === 'add' ? 1 : -1) * Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setError(null);
      setOpen(false);
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['hr', 'leaveBalances'] });
      void queryClient.invalidateQueries({ queryKey: ['hr', 'leaveLedger'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not adjust the balance.',
      ),
  });

  if (!open) {
    return (
      <div>
        <SecondaryButton type="button" onClick={() => setOpen(true)}>
          Adjust balance
        </SecondaryButton>
      </div>
    );
  }
  return (
    <form
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-gray-900">
        Adjust balance ({financialYearOf()})
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="adjust-type"
          label="Leave type"
          value={leaveType}
          onChange={(event) =>
            setLeaveType(event.target.value as CreditedLeaveType)
          }
        >
          {CREDITED_LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {hrLabel(type)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="adjust-direction"
          label="Add or deduct"
          value={direction}
          onChange={(event) =>
            setDirection(event.target.value as 'add' | 'deduct')
          }
        >
          <option value="add">Add days</option>
          <option value="deduct">Deduct days</option>
        </SelectField>
        <TextField
          id="adjust-days"
          label="Days"
          type="number"
          min={0.5}
          step={0.5}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <TextField
        id="adjust-reason"
        label="Reason"
        required
        maxLength={500}
        placeholder="e.g. Compensatory off for working on 2 Oct"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={save.isPending || !Number(amount) || !reason.trim()}
        >
          Save adjustment
        </Button>
        <SecondaryButton type="button" onClick={() => setOpen(false)}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}

const KIND_LABEL: Record<LeaveLedgerEntry['kind'], string> = {
  monthly_credit: 'Monthly credit',
  yearly_credit: 'Yearly credit',
  carry_forward: 'Carried forward',
  adjustment: 'Adjustment by HR',
  opening_import: 'Opening balance',
};

/** Where this year's balances came from — every credit, carry-forward, adjustment and import. */
function LeaveHistory({ employeeId }: { employeeId: string }) {
  const companyId = useSelectedCompanyId();
  const { data, isPending } = useQuery({
    queryKey: ['hr', 'leaveLedger', companyId, employeeId],
    queryFn: () => getLeaveLedger(companyId, employeeId),
  });
  if (isPending || !data || data.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">
        History ({financialYearOf()})
      </h3>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm">
        {data.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-start justify-between gap-2 px-4 py-2"
          >
            <div>
              <p className="text-gray-900">
                {KIND_LABEL[entry.kind]} · {hrLabel(entry.leaveType)}
                {entry.kind === 'monthly_credit' && entry.period
                  ? ` · ${periodLabel(entry.period)}`
                  : ''}
              </p>
              {entry.reason && (
                <p className="text-xs text-gray-500">{entry.reason}</p>
              )}
              <p className="text-xs text-gray-400">
                {dateLabel(entry.createdAt.slice(0, 10))}
              </p>
            </div>
            <span
              className={
                entry.days < 0
                  ? 'font-medium text-red-700'
                  : 'font-medium text-green-700'
              }
            >
              {entry.days > 0 ? '+' : ''}
              {days(entry.days)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

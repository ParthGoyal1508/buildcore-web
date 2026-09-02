'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  approveLoan,
  closeLoan,
  createLoan,
  getLoan,
  listEmployees,
  listLoans,
  type Loan,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, LOAN_STATUSES, MESSAGES, hrLabel } from '@/app/lib/constants';
import { currentPeriod, dateLabel, money, periodLabel, rupees, todayIso } from '@/app/lib/format';
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

function IssueLoanModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [disbursementDate, setDisbursementDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [firstRecoveryPeriod, setFirstRecoveryPeriod] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      createLoan({
        employeeId,
        amount: Number(amount),
        emiAmount: Number(emiAmount),
        disbursementDate,
        reason: reason.trim(),
        firstRecoveryPeriod: firstRecoveryPeriod || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const numericAmount = Number(amount);
  const numericEmi = Number(emiAmount);
  const canSubmit =
    employeeId &&
    numericAmount > 0 &&
    numericEmi > 0 &&
    reason.trim().length > 0 &&
    disbursementDate;

  // Shown before submitting, because "how long will this take to repay" is the
  // question anyone approving a loan actually has, and the schedule is only
  // generated on approval — too late to be useful here.
  const estimatedMonths =
    numericAmount > 0 && numericEmi > 0
      ? Math.ceil(numericAmount / numericEmi)
      : null;

  return (
    <Modal
      title="Issue a loan"
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
            {create.isPending ? 'Saving…' : 'Create loan'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {HR_MESSAGES.advanceDistinctFromLoan}
        </p>
        <SelectField
          id="loan-employee"
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
            id="loan-amount"
            label="Amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TextField
            id="loan-emi"
            label="Monthly EMI"
            type="number"
            step="0.01"
            value={emiAmount}
            onChange={(event) => setEmiAmount(event.target.value)}
            hint={
              estimatedMonths
                ? `About ${estimatedMonths} instalment${estimatedMonths === 1 ? '' : 's'}.`
                : undefined
            }
          />
          <TextField
            id="loan-date"
            label="Disbursement date"
            type="date"
            value={disbursementDate}
            onChange={(event) => setDisbursementDate(event.target.value)}
          />
          <TextField
            id="loan-first-period"
            label="First recovery period"
            type="month"
            value={firstRecoveryPeriod}
            onChange={(event) => setFirstRecoveryPeriod(event.target.value)}
            hint="The run the first EMI is deducted from."
          />
        </div>
        <TextField
          id="loan-reason"
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  );
}

/** The generated repayment schedule, shown once a loan is approved. */
function ScheduleModal({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'loan', loanId],
    queryFn: () => getLoan(loanId),
  });

  const paid =
    data?.schedule.filter((entry) => entry.status === 'paid').length ?? 0;

  return (
    <Modal
      title="Repayment schedule"
      onClose={onClose}
      wide
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      {data && (
        <p className="mb-3 text-sm text-gray-600">
          {rupees(data.amount)} at {rupees(data.emiAmount)} a month ·{' '}
          {paid} of {data.schedule.length} instalments paid
        </p>
      )}
      <DataTable
        caption="Repayment schedule"
        columns={[
          {
            key: 'period',
            header: 'Period',
            sticky: true,
            render: (row) => periodLabel(row.period),
          },
          { key: 'emi', header: 'EMI', numeric: true, render: (row) => money(row.emiAmount) },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          { key: 'paidAt', header: 'Paid on', render: (row) => dateLabel(row.paidAt) },
        ]}
        rows={data?.schedule ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No schedule yet — a loan's schedule is generated when it is approved."
      />
    </Modal>
  );
}

export default function LoansTable() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'loans', status],
    queryFn: () =>
      listLoans(status ? { status: status as (typeof LOAN_STATUSES)[number] } : {}),
  });

  const approve = useMutation({
    mutationFn: approveLoan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] }),
    onError: (err: Error) => setError(err.message),
  });

  const close = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      closeLoan(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] }),
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<Loan>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.employeeName ?? row.employeeCode ?? row.employeeId,
    },
    { key: 'amount', header: 'Amount', numeric: true, render: (row) => money(row.amount) },
    { key: 'emi', header: 'EMI', numeric: true, render: (row) => money(row.emiAmount) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      numeric: true,
      render: (row) => money(row.outstanding ?? null),
    },
    {
      key: 'disbursed',
      header: 'Disbursed',
      render: (row) => dateLabel(row.disbursementDate),
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
            id="loan-status"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {LOAN_STATUSES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="button" onClick={() => setIssuing(true)}>
          Issue a loan
        </Button>
      </div>

      <FormError message={error} />

      <DataTable
        caption="Loans"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No loans match this filter."
        actions={(row) => (
          <>
            <RowAction type="button" onClick={() => setViewing(row.id)}>
              Schedule
            </RowAction>
            {row.status === 'pending' && (
              <RowAction
                type="button"
                onClick={() => {
                  if (window.confirm(HR_MESSAGES.confirmApproveLoan(rupees(row.amount)))) {
                    approve.mutate(row.id);
                  }
                }}
              >
                Approve
              </RowAction>
            )}
            {row.status === 'active' && (
              <RowAction
                type="button"
                onClick={() => {
                  const reason = window.prompt('Why is this loan being closed?');
                  if (reason?.trim()) close.mutate({ id: row.id, reason: reason.trim() });
                }}
              >
                Close
              </RowAction>
            )}
          </>
        )}
      />

      {issuing && <IssueLoanModal onClose={() => setIssuing(false)} />}
      {viewing && <ScheduleModal loanId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  approveLoan,
  rejectLoan,
  closeLoan,
  createLoan,
  getLoan,
  listLoans,
  type Loan,
} from '@/app/lib/api/hr-payroll';
import {
  HR_MESSAGES,
  LOAN_STATUSES,
  MESSAGES,
  hrLabel,
} from '@/app/lib/constants';
import {
  currentPeriod,
  dateLabel,
  money,
  periodLabel,
  rupees,
  todayIso,
} from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import EmployeePicker from '@/app/ui/hr/employee-picker';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import { useApproverSelf } from '@/app/ui/hr/use-approver-self';
import { useToast } from '@/app/ui/toast';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';

function IssueLoanModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [disbursementDate, setDisbursementDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [firstRecoveryPeriod, setFirstRecoveryPeriod] =
    useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);


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
        <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {HR_MESSAGES.advanceDistinctFromLoan}
        </p>
        <EmployeePicker
          id="loan-employee"
          label="Employee"
          value={employeeId}
          onChange={(id) => setEmployeeId(id)}
          required
        />
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
function ScheduleModal({
  loanId,
  onClose,
}: {
  loanId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'loan', loanId],
    queryFn: () => getLoan(loanId),
  });

  const paid =
    data?.schedule.filter((entry) => entry.status === 'paid').length ?? 0;
  const outstanding = data?.outstanding;

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
          {rupees(data.amount)} at {rupees(data.emiAmount)} a month · {paid} of{' '}
          {data.schedule.length} instalments paid · {rupees(outstanding ?? 0)}{' '}
          outstanding
        </p>
      )}
      <DataTable
        caption="Repayment schedule"
        columns={[
          {
            key: 'month',
            header: 'Period',
            sticky: true,
            render: (row) => periodLabel(row.month),
          },
          {
            key: 'emi',
            header: 'EMI',
            numeric: true,
            render: (row) => money(row.emiAmount),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: 'run',
            header: 'Recovered by',
            // An EMI is collected by a payroll run, so the run is what the
            // schedule records — there is no separate payment date.
            render: (row) => (row.paidInPayrollRunId ? 'Payroll run' : '—'),
          },
        ]}
        rows={data?.schedule ?? []}
        rowKey={(row) => row.month}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No schedule yet — a loan's schedule is generated when it is approved."
      />
    </Modal>
  );
}

export default function LoansTable() {
  const queryClient = useQueryClient();
  const self = useApproverSelf();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'loans', status],
    queryFn: () =>
      listLoans(
        status ? { status: status as (typeof LOAN_STATUSES)[number] } : {},
      ),
  });

  // The ids on screen, so a name past the roster's first 100 is still resolved (036 F13).
  const employees = useEmployeeNames((data ?? []).map((loan) => loan.employeeId));

  const approve = useMutation({
    mutationFn: approveLoan,
    onSuccess: (result) => {
      setError(null);
      // The loan's approval chain may have further levels (2026-10-20): active only once the last
      // of them approves.
      toast.success(
        (result as { status?: string } | null)?.status === 'active'
          ? 'Loan approved; its repayment schedule is generated.'
          : 'Approval recorded; the loan moves to the next approver.',
      );
      queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] });
    },
    // 403 SELF_APPROVAL arrives with the server's own sentence.
    onError: (err: Error) => setError(errorMessage(err, 'Could not approve the loan.')),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectLoan(id, reason),
    onSuccess: () => {
      setError(null);
      toast.success('Loan rejected.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] });
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not reject the loan.')),
  });

  const close = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      closeLoan(id, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['hr', 'loans'] }),
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<Loan>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => money(row.amount),
    },
    {
      key: 'emi',
      header: 'EMI',
      numeric: true,
      render: (row) => money(row.emiAmount),
    },
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
            {row.status === 'pending' && self.isSelf({ createdByUserId: row.createdByUserId, employeeCode: employees.code(row.employeeId) }) && (
              // 036 F19: maker-checker. Whoever recorded the loan, or receives it, cannot approve.
              <span className="text-xs text-gray-500">Another approver must approve</span>
            )}
            {row.status === 'pending' && !self.isSelf({ createdByUserId: row.createdByUserId, employeeCode: employees.code(row.employeeId) }) && (
              <RowAction
                type="button"
                loading={approve.isPending && approve.variables === row.id}
                disabled={approve.isPending}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Approve this loan?',
                      message: `${employees.label(row.employeeId)}: ${HR_MESSAGES.confirmApproveLoan(
                        rupees(row.amount),
                      )} EMI ${rupees(row.emiAmount)} a month.`,
                      confirmLabel: 'Approve',
                      tone: 'default',
                    })
                  ) {
                    approve.mutate(row.id);
                  }
                }}
              >
                Approve
              </RowAction>
            )}
            {row.status === 'pending' && !self.isSelf({ createdByUserId: row.createdByUserId, employeeCode: employees.code(row.employeeId) }) && (
              <RowAction
                type="button"
                loading={reject.isPending && reject.variables?.id === row.id}
                disabled={reject.isPending}
                onClick={async () => {
                  const reason = await promptDialog({
                    title: 'Reject this loan?',
                    message: 'It will not be activated or deducted. Why?',
                    label: 'Reason',
                    required: true,
                    multiline: true,
                    confirmLabel: 'Reject',
                    tone: 'danger',
                  });
                  if (reason?.trim()) reject.mutate({ id: row.id, reason: reason.trim() });
                }}
              >
                Reject
              </RowAction>
            )}
            {row.status === 'active' && (
              <RowAction
                type="button"
                onClick={async () => {
                  const reason = await promptDialog({
                    title: 'Close this loan?',
                    message: 'Why is this loan being closed?',
                    required: true,
                    multiline: true,
                    confirmLabel: 'Close loan',
                    tone: 'danger',
                  });
                  if (reason?.trim())
                    close.mutate({ id: row.id, reason: reason.trim() });
                }}
              >
                Close
              </RowAction>
            )}
          </>
        )}
      />

      {issuing && <IssueLoanModal onClose={() => setIssuing(false)} />}
      {viewing && (
        <ScheduleModal loanId={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

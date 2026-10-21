'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  approveSalaryAdvance,
  rejectSalaryAdvance,
  createSalaryAdvance,
  listSalaryAdvances,
  type SalaryAdvance,
} from '@/app/lib/api/hr-payroll';
import {
  HR_MESSAGES,
  SALARY_ADVANCE_STATUSES,
  hrLabel,
} from '@/app/lib/constants';
import { currentPeriod, money, periodLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import EmployeePicker from '@/app/ui/hr/employee-picker';
import { useApproverSelf } from '@/app/ui/hr/use-approver-self';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';
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
        <EmployeePicker
          id="advance-employee"
          label="Employee"
          value={employeeId}
          onChange={(id) => setEmployeeId(id)}
          required
        />
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

  const self = useApproverSelf();
  const toast = useToast();
  const advances = useQuery({
    queryKey: ['hr', 'advances', status],
    queryFn: () =>
      listSalaryAdvances(
        status ? { status: status as (typeof SALARY_ADVANCE_STATUSES)[number] } : {},
      ),
  });

  const { data } = advances;
  const approve = useMutation({
    mutationFn: approveSalaryAdvance,
    onSuccess: (result) => {
      setError(null);
      // The advance's approval chain may have further levels (2026-10-20): it is paid only once the
      // last of them approves.
      toast.success(
        (result as { status?: string } | null)?.status === 'disbursed'
          ? 'Advance approved and disbursed.'
          : 'Approval recorded; the advance moves to the next approver.',
      );
      queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] });
    },
    // 403 SELF_APPROVAL arrives with the server's own sentence.
    onError: (err: Error) => setError(errorMessage(err, 'Could not approve the advance.')),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectSalaryAdvance(id, reason),
    onSuccess: () => {
      setError(null);
      toast.success('Advance rejected.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] });
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not reject the advance.')),
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
        isLoading={advances.isPending}
        error={advances.isError ? advances.error : null}
        onRetry={() => advances.refetch()}
        emptyMessage="No salary advances match this filter."
        actions={(row) =>
          row.status === 'pending' && self.isSelf(row) ? (
            // 036 F19: maker-checker. Whoever recorded the advance, or receives it, cannot approve.
            <span className="text-xs text-gray-500">Another approver must approve</span>
          ) : row.status === 'pending' ? (
            <>
            <RowAction
              type="button"
              loading={approve.isPending && approve.variables === row.id}
              disabled={approve.isPending}
              onClick={async () => {
                // Approving disburses money, so it names who gets how much (036 F19).
                if (
                  await confirmDialog({
                    title: 'Approve this advance?',
                    message: `${rupees(row.amount)} to ${
                      row.employeeName ?? row.employeeCode ?? 'this employee'
                    }, recovered from ${periodLabel(
                      row.recoveryMonth,
                    )} salary. Approving disburses it and cannot be undone.`,
                    confirmLabel: 'Approve and disburse',
                    tone: 'default',
                  })
                ) {
                  approve.mutate(row.id);
                }
              }}
            >
              Approve
            </RowAction>
            <RowAction
              type="button"
              loading={reject.isPending && reject.variables?.id === row.id}
              disabled={reject.isPending}
              onClick={async () => {
                const reason = await promptDialog({
                  title: 'Reject this advance?',
                  message: 'It will not be paid or recovered. Why?',
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
            </>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )
        }
      />

      {requesting && <RequestAdvanceModal onClose={() => setRequesting(false)} />}
    </div>
  );
}

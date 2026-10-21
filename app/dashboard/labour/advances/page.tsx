'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  approveAdvance,
  rejectAdvance,
  createAdvance,
  disburseAdvance,
  getAdvances,
  MAX_ADVANCE_AMOUNT,
  MAX_RECOVERY_INSTALMENTS,
  searchWorkerOptions,
  type Advance,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { useCashPolicy } from '@/app/lib/cash-entry';
import { labourLabel } from '@/app/lib/constants';
import { rupees, todayIso } from '@/app/lib/format';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';
import {
  RowAction,
  SecondaryButton,
  TextField,
  FormError,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [showForm, setShowForm] = useState(false);
  // 036 O12: which row's action is in flight. One shared mutation's `isPending` would lock — or
  // fail to lock — every row at once; this disables exactly the row being acted on.
  const [actingId, setActingId] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  // 038: a labour advance is paid in cash at site, so while the company hides cash there are none
  // to list and none may be raised. The tab leaves the Labour strip; a bookmark lands here on a
  // plain empty list rather than a refusal.
  const { hidden: cashHidden } = useCashPolicy();
  const advances = useQuery({
    queryKey: ['advances', companyId],
    queryFn: () => getAdvances({}),
    enabled: !cashHidden,
  });
  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['advances'] });

  const act = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'approve' | 'reject' | 'disburse';
      reason?: string;
    }) =>
      action === 'approve'
        ? approveAdvance(id)
        : action === 'reject'
          ? rejectAdvance(id, reason ?? '')
          : disburseAdvance(id),
    onMutate: ({ id }) => setActingId(id),
    onSuccess: (advance, { action }) => {
      toast.success(
        action === 'disburse'
          ? 'Advance disbursed.'
          : action === 'reject'
            ? 'Advance rejected.'
            : // The approval chain may have further levels (2026-10-20).
              advance.status === 'approved'
              ? 'Advance approved.'
              : 'Approval recorded; the advance moves to the next approver.',
      );
      return invalidate();
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError && e.code === 'SELF_APPROVAL'
          ? 'You raised this advance, so someone else must approve it.'
          : errorMessage(e, 'Could not update the advance.'),
      ),
    onSettled: () => setActingId(null),
  });

  const who = (a: Advance) => a.workerName ?? 'Unknown worker';
  const askApprove = async (a: Advance) => {
    const ok = await confirmDialog({
      title: 'Approve this advance?',
      message: `${rupees(a.amount)} to ${who(a)}, recovered in ${a.recoveryInstalments} instalment${a.recoveryInstalments === 1 ? '' : 's'} of ${rupees(a.instalmentAmount)}.${a.exceedsLimit ? ' It is above the advance limit for this worker.' : ''}`,
      confirmLabel: 'Approve',
    });
    if (ok) act.mutate({ id: a.id, action: 'approve' });
  };
  const askReject = async (a: Advance) => {
    const reason = await promptDialog({
      title: 'Reject this advance?',
      message: `${rupees(a.amount)} to ${who(a)}. It will not be paid or recovered. Why?`,
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: 'Reject',
      tone: 'danger',
    });
    if (reason?.trim()) act.mutate({ id: a.id, action: 'reject', reason: reason.trim() });
  };
  const askDisburse = async (a: Advance) => {
    const ok = await confirmDialog({
      title: 'Record this advance as paid?',
      message: `${rupees(a.amount)} handed to ${who(a)}. Recovery starts on their payment sheets from then on.`,
      confirmLabel: 'Disburse',
    });
    if (ok) act.mutate({ id: a.id, action: 'disburse' });
  };

  const columns: Column<Advance>[] = [
    {
      key: 'worker',
      header: 'Worker',
      // 036 O8: names from the API, not the raw worker id.
      render: (a) => (
        <>
          {who(a)}
          {a.labourCode && (
            <span className="ml-1 text-xs text-gray-500">{a.labourCode}</span>
          )}
          {a.createdByName && (
            <span className="block text-xs text-gray-500">
              Raised by {a.createdByName}
              {a.approvedByName ? ` · approved by ${a.approvedByName}` : ''}
            </span>
          )}
        </>
      ),
    },
    { key: 'amount', header: 'Amount', render: (a) => rupees(a.amount) },
    {
      key: 'instalments',
      header: 'Instalments',
      render: (a) => `${a.recoveryInstalments} × ${rupees(a.instalmentAmount)}`,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (a) => rupees(a.outstandingBalance),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <span className="flex items-center gap-1">
          <StatusBadge status={a.status} label={labourLabel(a.status)} />
          {a.exceedsLimit && (
            <StatusBadge status="warning" label="Exceeds limit" />
          )}
          {a.recoveryAtRisk && (
            <StatusBadge status="overdue" label="At risk" />
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <PageHeader
          title="Advances"
          description="Advances against wages and their recovery through payment sheets."
        />
        {!cashHidden && (
          <Button onClick={() => setShowForm(true)}>New Advance</Button>
        )}
      </div>

      <ResponsiveList
        columns={columns}
        rows={cashHidden ? [] : (advances.data ?? [])}
        rowKey={(a) => a.id}
        isLoading={!cashHidden && advances.isPending}
        error={cashHidden ? null : advances.error}
        onRetry={advances.refetch}
        emptyMessage={cashHidden ? 'No advances to show.' : 'No advances yet.'}
        actions={(a) => {
          // O12 maker-checker: the server refuses a requester approving their own advance
          // (`SELF_APPROVAL`), so the button is not offered to them.
          const own = !!user.data && a.createdBy === user.data.id;
          return (
            <span className="flex gap-2">
              {a.status === 'pending' && canApprove && !own && (
                <RowAction
                  onClick={() => void askApprove(a)}
                  loading={actingId === a.id}
                  disabled={actingId === a.id}
                >
                  Approve
                </RowAction>
              )}
              {a.status === 'pending' && canApprove && !own && (
                <RowAction
                  onClick={() => void askReject(a)}
                  disabled={actingId === a.id}
                >
                  Reject
                </RowAction>
              )}
              {a.status === 'pending' && canApprove && own && (
                <span className="text-xs text-gray-500">
                  Awaiting another approver
                </span>
              )}
              {a.status === 'approved' && canApprove && (
                <RowAction
                  onClick={() => void askDisburse(a)}
                  loading={actingId === a.id}
                  disabled={actingId === a.id}
                >
                  Disburse
                </RowAction>
              )}
            </span>
          );
        }}
      />

      {showForm && !cashHidden && (
        <AdvanceForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            toast.success('Advance raised. It needs approval before it is paid.');
            void invalidate();
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function AdvanceForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const companyId = useSelectedCompanyId();
  const [workerId, setWorkerId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [recoveryInstalments, setRecoveryInstalments] = useState('3');
  const [recoveryStartPeriod, setRecoveryStartPeriod] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);

  // 036 O12: the limits the server enforces, said beside the field first. 0 and 2.5 instalments
  // used to pass the form.
  const amountValue = Number(amount);
  const amountError =
    amount === ''
      ? undefined
      : !Number.isFinite(amountValue) || amountValue <= 0
      ? 'Enter an amount above zero.'
      : amountValue > MAX_ADVANCE_AMOUNT
      ? `At most ${rupees(MAX_ADVANCE_AMOUNT)}.`
      : undefined;
  const instalmentsValue = Number(recoveryInstalments);
  const instalmentsError =
    recoveryInstalments === ''
      ? undefined
      : !Number.isInteger(instalmentsValue) ||
        instalmentsValue < 1 ||
        instalmentsValue > MAX_RECOVERY_INSTALMENTS
      ? `A whole number from 1 to ${MAX_RECOVERY_INSTALMENTS}.`
      : undefined;

  const instalment =
    !amountError && !instalmentsError && amount && instalmentsValue > 0
      ? amountValue / instalmentsValue
      : 0;

  const mutation = useMutation({
    mutationFn: () =>
      createAdvance({
        workerId,
        amount: Number(amount),
        reason: reason.trim(),
        recoveryInstalments: Number(recoveryInstalments),
        recoveryStartPeriod,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not create the advance.')),
  });

  const dirty = !!workerId || amount !== '' || reason !== '';
  return (
    <Modal
      title="New Advance"
      onClose={onClose}
      isDirty={dirty}
      pending={mutation.isPending}
      // O15: buttons passed straight to the footer, so a phone stacks them full width.
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={
              !workerId ||
              !amount ||
              !reason.trim() ||
              !recoveryStartPeriod ||
              !!amountError ||
              !!instalmentsError ||
              recoveryInstalments === ''
            }
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <div>
          <label
            htmlFor="a-worker"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Worker *
          </label>
          {/* 036 O12: searched on the server — the select stopped at the first 200 workers. */}
          <AsyncSelect
            id="a-worker"
            value={workerId}
            onChange={(id) => setWorkerId(id)}
            search={(term, page) => searchWorkerOptions(term, page)}
            cacheKey={['labour-workers', companyId]}
            placeholder="Search by name or labour code"
          />
        </div>
        <TextField
          id="a-amount"
          label="Amount (₹) *"
          type="number"
          inputMode="decimal"
          required
          min="1"
          max={MAX_ADVANCE_AMOUNT}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amountError}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            id="a-instalments"
            label="Recovery instalments *"
            type="number"
            inputMode="numeric"
            required
            min="1"
            max={MAX_RECOVERY_INSTALMENTS}
            step="1"
            value={recoveryInstalments}
            onChange={(e) => setRecoveryInstalments(e.target.value)}
            error={instalmentsError}
          />
          <TextField
            id="a-start"
            label="Recovery starts from *"
            type="date"
            required
            value={recoveryStartPeriod}
            onChange={(e) => setRecoveryStartPeriod(e.target.value)}
          />
        </div>
        <TextField
          id="a-reason"
          label="Reason *"
          required
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {instalment > 0 && (
          <p className="text-sm text-gray-600">
            Per-instalment recovery: {rupees(instalment)}
          </p>
        )}
      </div>
    </Modal>
  );
}

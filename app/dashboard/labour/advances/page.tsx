'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approveAdvance,
  createAdvance,
  disburseAdvance,
  getAdvances,
  getWorkers,
  type Advance,
  type Worker,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { labourLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const advances = useQuery({
    queryKey: ['advances'],
    queryFn: () => getAdvances(),
  });
  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['advances'] });

  const approve = useMutation({
    mutationFn: (id: string) => approveAdvance(id),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not approve.'),
  });
  const disburse = useMutation({
    mutationFn: (id: string) => disburseAdvance(id),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not disburse.'),
  });

  const columns: Column<Advance>[] = [
    { key: 'worker', header: 'Worker', render: (a) => a.workerId },
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
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Advances</h1>
          <p className="text-sm text-gray-500">
            Advances against wages and their recovery through payment sheets.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>New Advance</Button>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={advances.data ?? []}
        rowKey={(a) => a.id}
        isLoading={advances.isPending}
        error={advances.isError ? 'Could not load advances.' : null}
        emptyMessage="No advances yet."
        actions={(a) => (
          <span className="flex gap-2">
            {a.status === 'pending' && canApprove && (
              <RowAction onClick={() => approve.mutate(a.id)}>Approve</RowAction>
            )}
            {a.status === 'approved' && canApprove && (
              <RowAction onClick={() => disburse.mutate(a.id)}>
                Disburse
              </RowAction>
            )}
          </span>
        )}
      />

      {showForm && (
        <AdvanceForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            invalidate();
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
  const [workerId, setWorkerId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [recoveryInstalments, setRecoveryInstalments] = useState('3');
  const [recoveryStartPeriod, setRecoveryStartPeriod] = useState('');
  const [error, setError] = useState<string | null>(null);

  const workers = useQuery({
    queryKey: ['workers', 'advance'],
    queryFn: () => getWorkers({ status: 'active', pageSize: 200 }),
  });

  const instalment =
    amount && Number(recoveryInstalments) > 0
      ? Number(amount) / Number(recoveryInstalments)
      : 0;

  const mutation = useMutation({
    mutationFn: () =>
      createAdvance({
        workerId,
        amount: Number(amount),
        reason,
        recoveryInstalments: Number(recoveryInstalments),
        recoveryStartPeriod,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not create the advance.'),
  });

  return (
    <Modal
      title="New Advance"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={
              !workerId || !amount || !reason || !recoveryStartPeriod
            }
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="a-worker"
          label="Worker"
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
        >
          <option value="">Select…</option>
          {workers.data?.items.map((w: Worker) => (
            <option key={w.id} value={w.id}>
              {w.fullName} ({w.labourCode})
            </option>
          ))}
        </SelectField>
        <TextField
          id="a-amount"
          label="Amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="a-instalments"
            label="Recovery instalments"
            type="number"
            min="1"
            value={recoveryInstalments}
            onChange={(e) => setRecoveryInstalments(e.target.value)}
          />
          <TextField
            id="a-start"
            label="Recovery start period"
            type="date"
            value={recoveryStartPeriod}
            onChange={(e) => setRecoveryStartPeriod(e.target.value)}
          />
        </div>
        <TextField
          id="a-reason"
          label="Reason"
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

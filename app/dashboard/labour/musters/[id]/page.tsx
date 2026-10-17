'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  approveMuster,
  getMuster,
  returnMuster,
  type MusterLine,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { labourLabel } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

// Keys match the line's own fields, so each column sorts by the raw value rather than its label.
const LINE_COLUMNS: Column<MusterLine>[] = [
  {
    key: 'workerId',
    header: 'Worker',
    // 036 O8: names from the API instead of the raw worker id.
    sortValue: (line) => line.workerName ?? line.labourCode ?? '',
    render: (line) => (
      <>
        {line.workerName ?? 'Unknown worker'}
        {line.labourCode && (
          <span className="ml-1 text-xs text-gray-500">{line.labourCode}</span>
        )}
        {(line.contractorName || line.skillCategoryName) && (
          <span className="block text-xs text-gray-500">
            {[line.skillCategoryName, line.contractorName]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </>
    ),
  },
  {
    key: 'attendanceType',
    header: 'Attendance',
    render: (line) => labourLabel(line.attendanceType),
  },
  {
    key: 'overtimeHours',
    header: 'Overtime',
    numeric: true,
    render: (line) => line.overtimeHours ?? '—',
  },
  {
    key: 'applicableRate',
    header: 'Rate',
    numeric: true,
    render: (line) => rupees(line.applicableRate),
  },
  {
    key: 'faceMatchLow',
    header: 'Face',
    render: (line) =>
      line.faceMatchLow ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
          needs review
        </span>
      ) : (
        <span className="text-gray-500">ok</span>
      ),
  },
];

export default function MusterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [returnReason, setReturnReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const muster = useQuery({
    queryKey: ['muster', id],
    queryFn: () => getMuster(id),
  });

  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['muster', id] }),
      queryClient.invalidateQueries({ queryKey: ['musters'] }),
    ]);
  const approve = useMutation({
    mutationFn: () => approveMuster(id),
    onSuccess: () => {
      toast.success('Muster approved.');
      return refresh();
    },
    onError: (e) =>
      setError(
        // 036 O4/O10: a payment sheet already covers this day, so approving it now would leave
        // the day never paid. The server says which sheet; this adds what to do about it.
        e instanceof ApiError && e.code === 'LABOUR_DAY_ON_PAYMENT_SHEET'
          ? `${e.message} Return it to the supervisor, or reopen or delete that payment sheet first.`
          : errorMessage(e, 'Could not approve.'),
      ),
  });
  const returnToDraft = useMutation({
    mutationFn: () => returnMuster(id, returnReason.trim()),
    onSuccess: () => {
      toast.success('Muster returned to the supervisor.');
      setReturnReason('');
      return refresh();
    },
    onError: (e) => setError(errorMessage(e, 'Could not return.')),
  });
  const busy = approve.isPending || returnToDraft.isPending;

  if (muster.isPending) {
    return <ListSkeleton headers={['Worker', 'Attendance', 'Overtime', 'Rate', 'Face']} />;
  }
  if (muster.isError || !muster.data) {
    return (
      <QueryError
        error={muster.error}
        onRetry={muster.refetch}
        fallback="Could not load this muster."
      />
    );
  }

  const m = muster.data;
  const readOnly = m.status !== 'submitted';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader
          title={<>Muster — {dateLabel(m.date)}</>}
          description={
            <>
              {m.siteName ?? 'Unknown site'} · Supervisor{' '}
              {m.supervisorName ?? 'unknown'}
              {m.approvedByName ? ` · Approved by ${m.approvedByName}` : ''}
            </>
          }
        />
        <StatusBadge status={m.status} />
      </div>

      {(m.geofenceViolation || m.lowGpsAccuracy) && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This muster is flagged for review:{' '}
          {m.geofenceViolation && 'outside the site geofence'}
          {m.geofenceViolation && m.lowGpsAccuracy && '; '}
          {m.lowGpsAccuracy && 'low GPS accuracy'}
          {m.distanceFromFenceMetres !== null &&
            ` (${Math.round(m.distanceFromFenceMetres)} m from fence)`}
          .
        </div>
      )}

      <FormError message={error} />

      {/* The shared table: sortable by any column (2026-10-15). */}
      <DataTable<MusterLine>
        caption="Muster lines"
        rows={m.lines}
        rowKey={(line) => line.id}
        columns={LINE_COLUMNS}
        emptyMessage="No workers on this muster."
      />

      {!readOnly && canApprove && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              id="return-reason"
              label="Return reason (required to return)"
              maxLength={500}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <SecondaryButton
              onClick={() => {
                setError(null);
                returnToDraft.mutate();
              }}
              disabled={!returnReason.trim() || busy}
              loading={returnToDraft.isPending}
            >
              Return
            </SecondaryButton>
            <Button
              onClick={async () => {
                setError(null);
                const ok = await confirmDialog({
                  title: 'Approve this muster?',
                  message: `${m.lines.length} worker${m.lines.length === 1 ? '' : 's'} on ${dateLabel(m.date)} will be counted for payment.`,
                  confirmLabel: 'Approve',
                });
                if (ok) approve.mutate();
              }}
              disabled={busy}
              loading={approve.isPending}
            >
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approveMuster,
  getMuster,
  returnMuster,
  type MusterLine,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { labourLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

// Keys match the line's own fields, so each column sorts by the raw value rather than its label.
const LINE_COLUMNS: Column<MusterLine>[] = [
  { key: 'workerId', header: 'Worker', render: (line) => line.workerId },
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
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
          needs review
        </span>
      ) : (
        <span className="text-gray-400">ok</span>
      ),
  },
];

export default function MusterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [returnReason, setReturnReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const muster = useQuery({
    queryKey: ['muster', id],
    queryFn: () => getMuster(id),
  });

  const canApprove = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;

  const approve = useMutation({
    mutationFn: () => approveMuster(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['muster', id] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not approve.'),
  });
  const returnToDraft = useMutation({
    mutationFn: () => returnMuster(id, returnReason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['muster', id] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not return.'),
  });

  if (muster.isPending) {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }
  if (muster.isError || !muster.data) {
    return (
      <p className="p-4 text-sm text-red-600">Could not load this muster.</p>
    );
  }

  const m = muster.data;
  const readOnly = m.status !== 'submitted';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader
          title={<>Muster — {m.date}</>}
          description={<>Supervisor {m.supervisorId}</>}
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
              disabled={!returnReason}
            >
              Return
            </SecondaryButton>
            <Button
              onClick={() => {
                setError(null);
                approve.mutate();
              }}
            >
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

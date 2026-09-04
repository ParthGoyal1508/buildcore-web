'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approveMuster,
  getMuster,
  returnMuster,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { labourLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { FormError, SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['muster', id] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not approve.'),
  });
  const returnToDraft = useMutation({
    mutationFn: () => returnMuster(id, returnReason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['muster', id] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not return.'),
  });

  if (muster.isPending) {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }
  if (muster.isError || !muster.data) {
    return <p className="p-4 text-sm text-red-600">Could not load this muster.</p>;
  }

  const m = muster.data;
  const readOnly = m.status !== 'submitted';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Muster — {m.date}
          </h1>
          <p className="text-sm text-gray-500">Supervisor {m.supervisorId}</p>
        </div>
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

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Worker</th>
              <th className="px-3 py-2">Attendance</th>
              <th className="px-3 py-2">Overtime</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Face</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {m.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">{line.workerId}</td>
                <td className="px-3 py-2">
                  {labourLabel(line.attendanceType)}
                </td>
                <td className="px-3 py-2">{line.overtimeHours ?? '—'}</td>
                <td className="px-3 py-2">{rupees(line.applicableRate)}</td>
                <td className="px-3 py-2">
                  {line.faceMatchLow ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      needs review
                    </span>
                  ) : (
                    <span className="text-gray-400">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

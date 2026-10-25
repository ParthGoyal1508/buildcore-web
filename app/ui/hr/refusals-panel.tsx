'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getPunchRefusals,
  type PunchRefusalRow,
} from '@/app/lib/api/hr-payroll';
import { LABOUR_REFUSAL_REASON_LABELS } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

/** The four reasons the log distinguishes, in the order the filter offers them.
 * `unlocatable` and `outside_geofence` stay separate on purpose: a rise in the first is usually
 * a phone or a building, a rise in the second is usually a fence. */
const REASONS = [
  'outside_geofence',
  'unlocatable',
  'face_mismatch',
  'no_face_detected',
] as const;

const metresLabel = (value: number | null) =>
  value === null ? '—' : `${Math.round(value)} m`;

/**
 * The staff punch refusal log (020 FR-013c, surfaced 042) — the staff counterpart of the labour
 * refusals list on the labour attendance page, with the same vocabulary: when, who, which punch,
 * why. The staff log additionally carries the evidence — distance outside the fence, the GPS
 * accuracy the device claimed, and the face-match distance — which is what distinguishes "the
 * camera saw somebody else" from "the light was bad" when somebody asks about last Tuesday.
 *
 * A **log, not a queue**: nothing here can be resolved or promoted into attendance, because a
 * refused punch was never recorded. A wrongly refused day is fixed by a manual attendance
 * correction, which goes through its own review. While the hard block is off (the default),
 * these are punches that were accepted and *would* have been refused.
 */
export default function RefusalsPanel() {
  const employees = useEmployeeNames();
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = {
    ...(employeeId ? { employeeId } : {}),
    ...(reason ? { reason: reason as PunchRefusalRow['reason'] } : {}),
    // Whole days: the backend filters on the punch's own timestamp.
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
  };

  const refusals = useQuery({
    // Every filter in the key, so changing one refetches rather than showing the last answer.
    queryKey: ['hr', 'punchRefusals', filters],
    queryFn: () => getPunchRefusals(filters),
  });

  const columns: Column<PunchRefusalRow>[] = [
    {
      key: 'capturedAt',
      header: 'Punched at',
      sticky: true,
      render: (row) => dateTimeLabel(row.capturedAt),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'type',
      header: 'Punch',
      render: (row) => (row.type === 'in' ? 'In' : 'Out'),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => LABOUR_REFUSAL_REASON_LABELS[row.reason] ?? row.reason,
    },
    {
      key: 'distance',
      header: 'Outside fence by',
      numeric: true,
      render: (row) => metresLabel(row.distanceMeters),
    },
    {
      key: 'accuracy',
      header: 'GPS accuracy',
      numeric: true,
      render: (row) => metresLabel(row.accuracyMeters),
    },
    {
      key: 'face',
      header: 'Face distance',
      numeric: true,
      // A raw match distance, for whoever reads the pattern — not something to round.
      render: (row) =>
        row.faceMatchDistance === null ? '—' : row.faceMatchDistance.toFixed(2),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Punches that were refused — or, while the hard refusal is off, were
        accepted and would have been. A log, not a queue: a refused punch was
        never recorded, so a wrongly refused day is fixed with a manual
        attendance correction on the daily register.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="refusal-employee"
          label="Employee"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">All employees</option>
          {employees.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="refusal-reason"
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          <option value="">All reasons</option>
          {REASONS.map((value) => (
            <option key={value} value={value}>
              {LABOUR_REFUSAL_REASON_LABELS[value] ?? value}
            </option>
          ))}
        </SelectField>
        <TextField
          id="refusal-from"
          label="From"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          id="refusal-to"
          label="To"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

      <DataTable
        caption="Punch refusals"
        columns={columns}
        rows={refusals.data ?? []}
        rowKey={(row) => row.id}
        isLoading={refusals.isPending}
        error={refusals.isError ? refusals.error : null}
        onRetry={() => refusals.refetch()}
        emptyMessage="No refusals match this filter."
      />
    </div>
  );
}

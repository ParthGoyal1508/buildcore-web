'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getDailyAttendance,
  listSites,
  markAttendance,
  type DailyAttendanceRow,
  type MarkAttendanceInput,
} from '@/app/lib/api/hr-payroll';
import { ApiError } from '@/app/lib/api/client';
import {
  ATTENDANCE_STATUS_OVERRIDES,
  HR_MESSAGES,
  MESSAGES,
  hrLabel,
} from '@/app/lib/constants';
import { timeLabel, todayIso } from '@/app/lib/format';
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

/** Shifts the selected date by whole days, for the arrow controls. */
function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The Mark/Edit dialog.
 *
 * Two backend rejections get their own treatment rather than a generic error:
 * a locked payroll period (423) and missing mandatory documents (400). Both are
 * things the admin can act on, and both are indistinguishable from "something
 * broke" if shown as a bare message.
 */
function MarkAttendanceModal({
  row,
  date,
  onClose,
}: {
  row: DailyAttendanceRow;
  date: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [inTime, setInTime] = useState(row.inTime ?? '');
  const [outTime, setOutTime] = useState(row.outTime ?? '');
  const [statusOverride, setStatusOverride] = useState(row.statusOverride ?? '');
  const [remarks, setRemarks] = useState(row.remarks ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const input: MarkAttendanceInput = {
        employeeId: row.employeeId,
        date,
        inTime: inTime || undefined,
        outTime: outTime || undefined,
        statusOverride: statusOverride
          ? (statusOverride as MarkAttendanceInput['statusOverride'])
          : undefined,
        remarks: remarks || undefined,
      };
      return markAttendance(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      onClose();
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 423) {
        setError(HR_MESSAGES.periodLocked);
        return;
      }
      setError(err.message);
    },
  });

  return (
    <Modal
      title={`${row.name} · ${row.employeeCode}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          Attendance for <strong>{date}</strong>. Every edit is recorded in the
          modifications trail with its before and after values.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="mark-in"
            label="In time"
            type="time"
            value={inTime}
            onChange={(event) => setInTime(event.target.value)}
          />
          <TextField
            id="mark-out"
            label="Out time"
            type="time"
            value={outTime}
            onChange={(event) => setOutTime(event.target.value)}
          />
        </div>
        <SelectField
          id="mark-status"
          label="Status override"
          value={statusOverride}
          onChange={(event) => setStatusOverride(event.target.value)}
        >
          <option value="">Derive from punches</option>
          {ATTENDANCE_STATUS_OVERRIDES.map((status) => (
            <option key={status} value={status}>
              {hrLabel(status)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="mark-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          hint="Shown in the modifications trail alongside the change."
        />
      </div>
    </Modal>
  );
}

export default function AttendanceTable() {
  const [date, setDate] = useState(todayIso());
  const [siteId, setSiteId] = useState('');
  const [editing, setEditing] = useState<DailyAttendanceRow | null>(null);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'attendance', date, siteId],
    queryFn: () => getDailyAttendance(date, siteId || undefined),
  });

  const columns: Column<DailyAttendanceRow>[] = [
    { key: 'code', header: 'Code', sticky: true, render: (row) => row.employeeCode },
    { key: 'name', header: 'Employee', render: (row) => row.name },
    { key: 'in', header: 'In', render: (row) => timeLabel(row.inTime) },
    { key: 'out', header: 'Out', render: (row) => timeLabel(row.outTime) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.statusOverride ?? 'present'} />,
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (row) => (
        <span className="flex flex-wrap gap-1.5">
          {row.adminEdited && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
              Edited
            </span>
          )}
          {row.hasException && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Exception
            </span>
          )}
          {!row.adminEdited && !row.hasException && (
            <span className="text-gray-400">—</span>
          )}
        </span>
      ),
    },
    { key: 'remarks', header: 'Remarks', render: (row) => row.remarks ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <label
            htmlFor="attendance-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Date
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDate((current) => shiftDate(current, -1))}
              aria-label="Previous day"
              className="rounded-md border border-gray-200 px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              ‹
            </button>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
            <button
              type="button"
              onClick={() => setDate((current) => shiftDate(current, 1))}
              aria-label="Next day"
              className="rounded-md border border-gray-200 px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              ›
            </button>
          </div>
        </div>
        <SelectField
          id="attendance-site"
          label="Site"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">All sites</option>
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
      </div>

      <DataTable
        caption="Daily attendance"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.employeeId}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage={HR_MESSAGES.noAttendance}
        actions={(row) => (
          <RowAction type="button" onClick={() => setEditing(row)}>
            {row.inTime || row.outTime ? 'Edit' : 'Mark'}
          </RowAction>
        )}
      />

      {editing && (
        <MarkAttendanceModal
          row={editing}
          date={date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

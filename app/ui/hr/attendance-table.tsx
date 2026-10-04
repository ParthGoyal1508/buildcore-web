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
 *
 * **This dialog submits a correction for approval; it does not save an edit** (016 FR-009c).
 * Since api 016 phase 8 the day is unchanged until a Site → HR → Director chain completes, so
 * every word here that promised an immediate change has been corrected. The version that said
 * "Save" and then closed on success was the worst available outcome: the table refetched,
 * showed the old figures, and offered no reason — which reads as a save that failed silently.
 *
 * `onSubmitted` rather than `onClose` on success, so the caller can say what happened. Closing
 * a dialog is not an explanation.
 */
function MarkAttendanceModal({
  row,
  date,
  onClose,
  onSubmitted,
}: {
  row: DailyAttendanceRow;
  date: string;
  onClose: () => void;
  onSubmitted: () => void;
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
      // Refetched because the row now carries an outstanding-correction marker, which is the
      // one thing about the day that *did* change. The times and status deliberately have not.
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      onSubmitted();
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
            {save.isPending
              ? HR_MESSAGES.correctionSubmitting
              : HR_MESSAGES.correctionSubmit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          {HR_MESSAGES.correctionDialogHint(date)}
        </p>
        {row.pendingCorrection && (
          <p className="text-sm text-amber-800">
            {HR_MESSAGES.correctionPendingHint}
          </p>
        )}
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
          hint={HR_MESSAGES.correctionRemarksHint}
        />
      </div>
    </Modal>
  );
}

export default function AttendanceTable() {
  // Recomputed on render rather than held in state: a tab left open overnight
  // would otherwise keep yesterday as its ceiling and refuse the current day.
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [siteId, setSiteId] = useState('');
  const [editing, setEditing] = useState<DailyAttendanceRow | null>(null);
  /**
   * What the last submission did, shown until the administrator moves on.
   *
   * Not a toast. A correction that will be decided by three other people over the next days is
   * not a transient acknowledgement, and the marker on the row (below) is what carries it once
   * this clears — so the two together mean the screen never again implies the day changed.
   */
  const [submitted, setSubmitted] = useState(false);
  const isToday = date >= today;

  // Cleared when the view moves: the notice is about the submission just made, and leaving it
  // up over a different date or site would attach it to rows it has nothing to do with.
  const changeView = (apply: () => void) => {
    setSubmitted(false);
    apply();
  };

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['hr', 'attendance', date, siteId],
    queryFn: () => getDailyAttendance(date, siteId || undefined),
  });

  // The API refuses a future date (backend FR-071). The controls below make that
  // unreachable by clicking, but a restored URL or a tab left open past midnight
  // still can, and "Could not load" would misdescribe a refusal the user can act
  // on by picking another date.
  const loadError = isError
    ? error instanceof ApiError && error.status === 400
      ? error.message
      : MESSAGES.loadFailed
    : null;

  const columns: Column<DailyAttendanceRow>[] = [
    { key: 'code', header: 'Code', sticky: true, render: (row) => row.employeeCode },
    { key: 'name', header: 'Employee', render: (row) => row.name },
    { key: 'in', header: 'In', render: (row) => timeLabel(row.inTime) },
    { key: 'out', header: 'Out', render: (row) => timeLabel(row.outTime) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
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
          {row.pendingCorrection && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {row.pendingCorrection.levelLabel
                ? HR_MESSAGES.correctionAwaiting(
                    row.pendingCorrection.levelLabel,
                  )
                : HR_MESSAGES.correctionAwaitingUnknown}
            </span>
          )}
          {!row.adminEdited && !row.hasException && !row.pendingCorrection && (
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
              onClick={() =>
                changeView(() => setDate((current) => shiftDate(current, -1)))
              }
              aria-label="Previous day"
              // `min-h-11 min-w-11` is 44×44px — the touch target Principle VI's mobile-critical
              // standard requires (016 T112). `px-3` alone gave a target about 24px tall: fine with a
              // mouse, and a supervisor on a site with one hand on a phone misses it.
              className="min-h-11 min-w-11 rounded-md border border-gray-200 px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              ‹
            </button>
            <input
              id="attendance-date"
              type="date"
              value={date}
              max={today}
              // `max` is advisory in some browsers when the value is typed rather
              // than picked, so the ceiling is applied here too — attendance is a
              // record of what happened, and there is nothing to show for a day
              // that has not.
              onChange={(event) =>
                changeView(() =>
                  setDate(
                    event.target.value > today ? today : event.target.value,
                  ),
                )
              }
              className="block min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
            <button
              type="button"
              onClick={() =>
                changeView(() => setDate((current) => shiftDate(current, 1)))
              }
              aria-label="Next day"
              disabled={isToday}
              title={isToday ? 'Today is the latest date with attendance' : undefined}
              className="min-h-11 min-w-11 rounded-md border border-gray-200 px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
        </div>
        <SelectField
          id="attendance-site"
          label="Site"
          value={siteId}
          onChange={(event) => changeView(() => setSiteId(event.target.value))}
        >
          <option value="">All sites</option>
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
      </div>

      {submitted && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {HR_MESSAGES.correctionSubmitted}
        </p>
      )}

      <DataTable
        caption="Daily attendance"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.employeeId}
        isLoading={isLoading}
        error={loadError}
        emptyMessage={HR_MESSAGES.noAttendance}
        actions={(row) => (
          <RowAction
            type="button"
            // 016 T111. **This** is the control that must work at 320px: the reason this screen is on
            // the mobile-critical list is a supervisor on a site fixing a day the punch refusal
            // turned away, and raising the correction is the act. The grid beside it is wide by
            // nature and stays a horizontal scroller — reading a grid sideways is a nuisance, being
            // unable to reach the control is a failure.
            className="min-h-11 w-full justify-center sm:w-auto"
            onClick={() => setEditing(row)}
          >
            {row.inTime || row.outTime ? 'Edit' : 'Mark'}
          </RowAction>
        )}
      />

      {editing && (
        <MarkAttendanceModal
          row={editing}
          date={date}
          onClose={() => setEditing(null)}
          onSubmitted={() => {
            setEditing(null);
            setSubmitted(true);
          }}
        />
      )}
    </div>
  );
}

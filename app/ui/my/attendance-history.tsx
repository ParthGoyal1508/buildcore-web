'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import {
  getAttendanceHistory,
  type AttendanceDay,
  type AttendanceModification,
  type AttendanceSnapshot,
} from '@/app/lib/api/my-workspace';
import { MESSAGES, MY_ATTENDANCE_MESSAGES } from '@/app/lib/constants';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

const STATUS_LABEL: Record<AttendanceDay['status'], string> = {
  present: 'Present',
  absent: 'Absent',
  on_leave: 'On Leave',
  weekly_off: 'Weekly Off',
  holiday: 'Holiday',
};

/** Distinct per status (spec FR-008). Absent is the only one in red: it is the
 * only status that costs the employee money, so it should be the one that catches
 * the eye when they scan the month. */
const STATUS_CLASS: Record<AttendanceDay['status'], string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  on_leave: 'bg-blue-100 text-blue-800',
  weekly_off: 'bg-gray-100 text-gray-600',
  holiday: 'bg-purple-100 text-purple-800',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const timeOnly = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

/**
 * A modification snapshot's `HH:mm` rendered in the same zone as the row's own times.
 *
 * **The conversion is the whole point of this function.** `inTime` on the day is an ISO instant
 * that `timeOnly` above renders in the reader's zone; a snapshot's `inTime` is `HH:mm` in **UTC**,
 * because the API builds it with `toISOString().slice(11, 16)`. Rendered as-is, an employee in IST
 * reads "In: 03:35 → 03:40" directly beneath a row saying 09:05 — three correct numbers that
 * together say nothing true. The day's own date supplies the rest of the instant.
 */
const snapshotTime = (date: string, hhmm: string | null | undefined) => {
  if (!hhmm) return MY_ATTENDANCE_MESSAGES.empty;
  const at = new Date(`${date}T${hhmm}:00Z`);
  return Number.isNaN(at.getTime())
    ? // Not silently blanked: an unparseable value is shown as it arrived, because a blank here
      // would be indistinguishable from "this field was not set".
      hhmm
    : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/** What actually moved between the two sides, in the order the row presents its columns. */
function changedFields(
  date: string,
  before: AttendanceSnapshot,
  after: AttendanceSnapshot,
): string[] {
  const out: string[] = [];
  for (const field of ['inTime', 'outTime'] as const) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (from === to) continue;
    out.push(
      MY_ATTENDANCE_MESSAGES.fieldChange(
        MY_ATTENDANCE_MESSAGES.fieldNames[field],
        snapshotTime(date, from),
        snapshotTime(date, to),
      ),
    );
  }
  const statusFrom = before.statusOverride ?? null;
  const statusTo = after.statusOverride ?? null;
  if (statusFrom !== statusTo) {
    out.push(
      MY_ATTENDANCE_MESSAGES.fieldChange(
        MY_ATTENDANCE_MESSAGES.fieldNames.statusOverride,
        statusFrom
          ? (STATUS_LABEL[statusFrom as AttendanceDay['status']] ?? statusFrom)
          : MY_ATTENDANCE_MESSAGES.empty,
        statusTo
          ? (STATUS_LABEL[statusTo as AttendanceDay['status']] ?? statusTo)
          : MY_ATTENDANCE_MESSAGES.empty,
      ),
    );
  }
  return out;
}

/**
 * The administrative changes to one day, as a property of that day (016 FR-009a to FR-009c).
 *
 * **No dismiss control, no "seen" state, nothing stored** (T045). The requirement says so
 * explicitly, and the reason is worth keeping written down: a dismissable record of somebody else
 * changing your attendance is a record that disappears the first time it is inconvenient.
 *
 * It renders inside the day's own row rather than as a banner or a notification, because it is a
 * fact about that day and not an event in a feed — and because a feed would separate the change
 * from the figures it explains (T044).
 */
function DayModifications({
  day,
  modifications,
}: {
  day: string;
  modifications: AttendanceModification[];
}) {
  return (
    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">
        {MY_ATTENDANCE_MESSAGES.changedHeading(modifications.length)}
      </p>
      <ul className="mt-2 space-y-3">
        {modifications.map((modification, index) => {
          const changes = changedFields(
            day,
            modification.before,
            modification.after,
          );
          return (
            <li
              // Nothing on a modification is unique — the same actor may correct the same day
              // twice in one second — so the index is the honest key here.
              key={`${modification.at}-${index}`}
              className="border-t border-amber-200 pt-3 first:border-none first:pt-0"
            >
              <p>
                {MY_ATTENDANCE_MESSAGES.changedBy(
                  modification.actorName,
                  new Date(modification.at).toLocaleString(),
                )}
              </p>
              {changes.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {changes.map((change) => (
                    // `break-words`, because at 320px "Status: Weekly Off → Present" is wider
                    // than the card and must wrap rather than push the page sideways (T049).
                    <li key={change} className="break-words">
                      {change}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">
                  {MY_ATTENDANCE_MESSAGES.noFieldsChanged}
                </p>
              )}
              <p className="mt-1 italic">
                {modification.reason
                  ? MY_ATTENDANCE_MESSAGES.reasonGiven(modification.reason)
                  : MY_ATTENDANCE_MESSAGES.reasonMissing}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AttendanceHistory() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'attendance', month, year],
    queryFn: () => getAttendanceHistory(month, year),
  });

  // The current month is the newest one there can be attendance for, so stepping
  // past it only ever produces an empty table.
  const isCurrentMonth = month === currentMonth && year === currentYear;

  function step(delta: number) {
    // Arithmetic on a Date rather than manual month/year wrapping — December → 
    // January is exactly the boundary hand-rolled code gets wrong.
    const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
    const shiftedMonth = shifted.getUTCMonth() + 1;
    const shiftedYear = shifted.getUTCFullYear();
    // Guarded here as well as on the button: `disabled` is the affordance, this is
    // what actually makes a future month unreachable.
    if (
      shiftedYear > currentYear ||
      (shiftedYear === currentYear && shiftedMonth > currentMonth)
    ) {
      return;
    }
    setMonth(shiftedMonth);
    setYear(shiftedYear);
  }

  const columns: Column<AttendanceDay>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (day) => (
        <span className="whitespace-nowrap">
          {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC',
          })}
        </span>
      ),
    },
    { key: 'in', header: 'In', render: (day) => timeOnly(day.inTime) },
    { key: 'out', header: 'Out', render: (day) => timeOnly(day.outTime) },
    {
      key: 'ot',
      header: 'OT',
      render: (day) => (day.otHours != null ? day.otHours : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (day) => (
        <span
          className={clsx(
            'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
            STATUS_CLASS[day.status],
          )}
        >
          {STATUS_LABEL[day.status]}
        </span>
      ),
    },
  ];

  return (
    <section className="mt-8">
      {/*
        `flex-wrap` and a narrower month label: at 320px (constitution v2.1.0) the
        heading plus the month stepper measured 321px against 288px of usable width
        and pushed the whole page sideways. Found by the 016 Pass 9 sweep, which
        reaches this component because the punch page now carries an approval surface.
      */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-gray-900">Attendance</h2>
        <div className="flex items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            ‹
          </SecondaryButton>
          <span className="min-w-[7rem] text-center text-sm font-medium text-gray-700">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <SecondaryButton
            type="button"
            onClick={() => step(1)}
            disabled={isCurrentMonth}
            aria-label={
              isCurrentMonth
                ? 'Next month unavailable — this is the current month'
                : 'Next month'
            }
          >
            ›
          </SecondaryButton>
        </div>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(day) => day.date}
        detail={(day) =>
          day.modifications.length > 0 ? (
            <DayModifications day={day.date} modifications={day.modifications} />
          ) : null
        }
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No attendance recorded for this month."
      />
    </section>
  );
}

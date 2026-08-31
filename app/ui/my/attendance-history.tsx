'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import {
  getAttendanceHistory,
  type AttendanceDay,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-gray-900">Attendance</h2>
        <div className="flex items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            ‹
          </SecondaryButton>
          <span className="min-w-[8.5rem] text-center text-sm font-medium text-gray-700">
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
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No attendance recorded for this month."
      />
    </section>
  );
}

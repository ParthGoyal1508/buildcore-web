'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { getEmployeeAttendanceMonth } from '@/app/lib/api/hr-payroll';
import { MESSAGES, STATUS_BADGE_CLASSES, hrLabel } from '@/app/lib/constants';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The statuses a day can carry, in the order the legend lists them. */
const LEGEND = ['present', 'absent', 'on_leave', 'weekly_off', 'holiday'] as const;

/**
 * A month of one employee's attendance as a calendar grid.
 *
 * A calendar rather than a list because the question this answers is "what does
 * their month look like" — clusters of absence next to weekends, a gap around a
 * leave period. A list of thirty rows makes that shape invisible.
 */
export default function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'attendanceMonth', employeeId, month, year],
    queryFn: () => getEmployeeAttendanceMonth(employeeId, month, year),
  });

  function shift(by: number) {
    const next = new Date(Date.UTC(year, month - 1 + by, 1));
    setMonth(next.getUTCMonth() + 1);
    setYear(next.getUTCFullYear());
  }

  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );

  const days = data?.days ?? [];
  // Blank cells so the 1st lands under the right weekday.
  const leadingBlanks = days.length > 0 ? days[0].dayOfWeek : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-medium text-gray-900">{label}</h3>
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={() => shift(-1)}>
            Previous
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => shift(1)}>
            Next
          </SecondaryButton>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      )}
      {isError && (
        <p className="text-sm text-red-600" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <div className="overflow-x-auto">
            <div className="grid min-w-[35rem] grid-cols-7 gap-1.5">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  {weekday}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }).map((_, index) => (
                <div key={`blank-${index}`} aria-hidden="true" />
              ))}
              {days.map((day) => (
                <div
                  key={day.date}
                  className={clsx(
                    'rounded-md p-2 text-xs',
                    STATUS_BADGE_CLASSES[day.status] ?? 'bg-gray-100 text-gray-700',
                  )}
                >
                  <div className="font-medium tabular-nums">
                    {Number(day.date.slice(-2))}
                  </div>
                  <div className="mt-0.5">{hrLabel(day.status)}</div>
                  {(day.inTime || day.outTime) && (
                    <div className="mt-0.5 tabular-nums opacity-80">
                      {day.inTime ?? '—'} – {day.outTime ?? '—'}
                    </div>
                  )}
                  {day.otHours ? (
                    <div className="mt-0.5 opacity-80">OT {day.otHours}h</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* The colours mean nothing on their own — the legend is what makes the
              grid readable, and every cell also carries its status as text. */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {LEGEND.map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span
                  className={clsx(
                    'inline-block h-3 w-3 rounded-sm',
                    STATUS_BADGE_CLASSES[status],
                  )}
                  aria-hidden="true"
                />
                {hrLabel(status)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

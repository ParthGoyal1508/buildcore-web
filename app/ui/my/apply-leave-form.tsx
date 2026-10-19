'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  applyLeave,
  getLeaveBalance,
  getLeaveDayCount,
  LEAVE_TYPES,
  type LeaveType,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { useDebounced } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import QueryError from '@/app/ui/query-error';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { financialYearOf, LEAVE_TYPE_LABEL } from '@/app/ui/my/leave-balance';

const HTTP_LOCKED = 423;
/** How long the dates must sit still before the server is asked to count them. */
const DAY_COUNT_DEBOUNCE_MS = 350;

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const EMPTY = {
  leaveType: 'earned' as LeaveType,
  fromDate: '',
  toDate: '',
  reason: '',
};

export default function ApplyLeaveForm() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const financialYear = financialYearOf(
    form.fromDate ? new Date(`${form.fromDate}T00:00:00Z`) : new Date(),
  );

  const { data: balances } = useQuery({
    queryKey: ['my', 'leave-balance', financialYear],
    queryFn: () => getLeaveBalance(financialYear),
  });

  // 036 G3: the count comes from the server, which knows the employee's site weekly off and
  // holidays. The local Saturday/Sunday skip this replaces was wrong on a six-day site week (it
  // dropped a working Saturday) and blind to holidays, so the number shown and the number the
  // application was then charged disagreed. Debounced so typing a date does not fire a request per
  // keystroke; compared against the live dates so a stale answer never gates the submit button.
  const range =
    form.fromDate && form.toDate && form.toDate >= form.fromDate
      ? `${form.fromDate}|${form.toDate}`
      : null;
  const settledRange = useDebounced(range, DAY_COUNT_DEBOUNCE_MS);
  const [fromDate, toDate] = (settledRange ?? '|').split('|');
  const dayCountQuery = useQuery({
    queryKey: ['my', 'leave-day-count', fromDate, toDate],
    queryFn: () => getLeaveDayCount(fromDate, toDate),
    enabled: settledRange !== null && settledRange === range,
    // A 400 (range over a year) will be refused the same way again.
    retry: false,
  });
  const preview =
    range !== null && settledRange === range ? dayCountQuery.data : undefined;
  const counting =
    range !== null && (settledRange !== range || dayCountQuery.isFetching);
  const dayCount = preview?.days ?? 0;

  const available =
    balances?.find((b) => b.leaveType === form.leaveType)?.balance ?? 0;
  // LWP is never balance-checked — it is unpaid by definition, so there is no
  // entitlement for it to exhaust (matching the backend's own rule).
  const isOverBalance =
    form.leaveType !== 'lwp' && dayCount > 0 && dayCount > available;

  const submit = useMutation({
    mutationFn: () => applyLeave(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my', 'leave-balance'] });
      setForm(EMPTY);
      setError(null);
      toast.success('Leave application submitted');
    },
    // The form keeps what was typed on a failure, so a corrected retry is one tap.
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === HTTP_LOCKED) {
        setError(MESSAGES.payrollLocked);
        return;
      }
      setError(errorMessage(err, MESSAGES.saveFailed));
    },
  });

  const canSubmit =
    form.fromDate !== '' &&
    form.toDate !== '' &&
    form.reason.trim() !== '' &&
    preview !== undefined &&
    !counting &&
    dayCount > 0 &&
    !isOverBalance &&
    !submit.isPending;

  return (
    <section className="mt-8 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-medium text-gray-900">
        Apply for leave
      </h2>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <FormError message={error} />

        <SelectField
          id="leave-type"
          label="Leave type"
          value={form.leaveType}
          onChange={(event) =>
            setForm({ ...form, leaveType: event.target.value as LeaveType })
          }
        >
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {LEAVE_TYPE_LABEL[type]}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="from-date"
            label="From"
            type="date"
            required
            value={form.fromDate}
            onChange={(event) =>
              setForm({ ...form, fromDate: event.target.value })
            }
          />
          <TextField
            id="to-date"
            label="To"
            type="date"
            required
            min={form.fromDate || undefined}
            value={form.toDate}
            onChange={(event) =>
              setForm({ ...form, toDate: event.target.value })
            }
          />
        </div>

        {range !== null && (
          <div className="rounded-md bg-gray-50 px-3 py-2" aria-live="polite">
            {counting && !preview ? (
              <p className="text-sm text-gray-500" role="status">
                Counting working days…
              </p>
            ) : dayCountQuery.isError && !counting ? (
              <QueryError
                compact
                error={dayCountQuery.error}
                fallback="Could not count the working days in this range."
                onRetry={dayCountQuery.refetch}
              />
            ) : preview ? (
              <>
                <p className="text-sm text-gray-700">
                  <strong>{preview.days}</strong> working day
                  {preview.days === 1 ? '' : 's'}
                  {form.leaveType !== 'lwp' && ` · ${available} available`}
                </p>
                {preview.excluded.length > 0 && (
                  <>
                    <p className="mt-1 text-xs text-gray-500">
                      Not counted:
                    </p>
                    <ul className="mt-0.5 space-y-0.5 text-xs text-gray-600">
                      {preview.excluded.map((day) => (
                        <li key={day.date}>
                          {dateLabel(day.date)} —{' '}
                          {day.reason === 'holiday'
                            ? 'holiday'
                            : `weekly off (${WEEKDAY_NAMES[preview.weeklyOffDay] ?? 'site'})`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {preview.days === 0 && (
                  <p className="mt-1 text-xs text-amber-700" role="alert">
                    Every day in this range is a weekly off or a holiday, so
                    there is nothing to apply for.
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}

        {isOverBalance && (
          <p role="alert" className="text-sm text-red-600">
            This is more than your remaining {LEAVE_TYPE_LABEL[form.leaveType]}{' '}
            balance of {available} day{available === 1 ? '' : 's'}.
          </p>
        )}

        <TextField
          id="leave-reason"
          label="Reason"
          value={form.reason}
          required
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
          placeholder="e.g. Family function"
        />

        <Button type="submit" disabled={!canSubmit} loading={submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Apply'}
        </Button>
      </form>
    </section>
  );
}

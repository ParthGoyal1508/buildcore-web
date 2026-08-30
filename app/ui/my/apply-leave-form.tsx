'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  applyLeave,
  getLeaveBalance,
  LEAVE_TYPES,
  type LeaveType,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { financialYearOf, LEAVE_TYPE_LABEL } from '@/app/ui/my/leave-balance';

const HTTP_LOCKED = 423;
const MS_PER_DAY = 86_400_000;

/**
 * An approximate chargeable-day count for the range (spec FR-011).
 *
 * Weekends are excluded; the employee's site holidays are not, because no endpoint
 * exposes a site's holiday calendar to this app — the backend reads it internally
 * when it computes the authoritative count. The preview is therefore an upper
 * bound, and is labelled as approximate rather than presented as final: showing a
 * confident number that the server then contradicts is worse than admitting the
 * estimate.
 */
export function approximateDayCount(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  const start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;

  let count = 0;
  for (let t = start; t <= end; t += MS_PER_DAY) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

const EMPTY = {
  leaveType: 'earned' as LeaveType,
  fromDate: '',
  toDate: '',
  reason: '',
};

export default function ApplyLeaveForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const financialYear = financialYearOf(
    form.fromDate ? new Date(`${form.fromDate}T00:00:00Z`) : new Date(),
  );

  const { data: balances } = useQuery({
    queryKey: ['my', 'leave-balance', financialYear],
    queryFn: () => getLeaveBalance(financialYear),
  });

  const dayCount = useMemo(
    () => approximateDayCount(form.fromDate, form.toDate),
    [form.fromDate, form.toDate],
  );

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
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === HTTP_LOCKED) {
        setError(MESSAGES.payrollLocked);
        return;
      }
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed);
    },
  });

  const canSubmit =
    form.fromDate !== '' &&
    form.toDate !== '' &&
    form.reason.trim() !== '' &&
    dayCount > 0 &&
    !isOverBalance &&
    !submit.isPending;

  return (
    <section className="mt-8 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-medium text-gray-900">Apply for leave</h2>

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
            value={form.fromDate}
            onChange={(event) =>
              setForm({ ...form, fromDate: event.target.value })
            }
          />
          <TextField
            id="to-date"
            label="To"
            type="date"
            min={form.fromDate || undefined}
            value={form.toDate}
            onChange={(event) => setForm({ ...form, toDate: event.target.value })}
          />
        </div>

        {dayCount > 0 && (
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-700">
              About <strong>{dayCount}</strong> day{dayCount === 1 ? '' : 's'}
              {form.leaveType !== 'lwp' && ` · ${available} available`}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {MESSAGES.leaveDayCountApprox}
            </p>
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
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
          placeholder="e.g. Family function"
        />

        <Button type="submit" disabled={!canSubmit}>
          {submit.isPending ? 'Submitting…' : 'Apply'}
        </Button>
      </form>
    </section>
  );
}

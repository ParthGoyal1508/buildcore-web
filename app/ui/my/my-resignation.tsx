'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getMyResignations,
  RESIGNATION_REASONS,
  submitMyResignation,
  withdrawMyResignation,
} from '@/app/lib/api/my-workspace';
import { dateLabel, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import { LoadingText } from '@/app/ui/spinner';

const REASON_LABELS: Record<(typeof RESIGNATION_REASONS)[number], string> = {
  better_opportunity: 'Better opportunity',
  personal: 'Personal reasons',
  relocation: 'Relocation',
  health: 'Health',
  compensation: 'Compensation',
  work_environment: 'Work environment',
  other: 'Other',
};

/**
 * Resigning from My Workspace, and following it through (2026-10-16).
 *
 * The record is the one HR's Resignations screen lists and accepts. The notice starts at 30 days
 * from the resignation date; HR agrees the actual last working day — or waives notice — when they
 * accept, and the agreed date shows here. While it is still submitted, the employee may withdraw
 * it.
 */
export default function MyResignation() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ['my', 'resignation'],
    queryFn: getMyResignations,
  });
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] =
    useState<(typeof RESIGNATION_REASONS)[number]>('better_opportunity');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['my', 'resignation'] });
  const submit = useMutation({
    mutationFn: () =>
      submitMyResignation({
        resignationDate: date,
        reasonCategory: reason,
        reasonDetail: detail.trim(),
      }),
    onSuccess: () => {
      setError(null);
      setDetail('');
      refresh();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not submit.'),
  });
  const withdraw = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      withdrawMyResignation(input.id, input.reason),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not withdraw.'),
  });

  if (isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load your resignation.
      </p>
    );
  }

  const open = data.find((r) => r.status !== 'withdrawn');

  return (
    <div className="space-y-6">
      <FormError message={error} />
      {open ? (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              Your resignation
            </h2>
            <StatusBadge status={open.status} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Resigned on</dt>
              <dd>{dateLabel(open.resignationDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Reason</dt>
              <dd>{REASON_LABELS[open.reasonCategory]}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">
                {open.agreedLastWorkingDay
                  ? 'Agreed last working day'
                  : 'Expected last working day'}
              </dt>
              <dd className="font-medium">
                {dateLabel(
                  open.agreedLastWorkingDay ?? open.expectedLastWorkingDay,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Notice</dt>
              <dd>{open.noticePeriodDays} days</dd>
            </div>
          </dl>
          <p className="text-sm text-gray-600">
            {open.status === 'submitted'
              ? 'HR will confirm your last working day when they accept it.'
              : 'HR has accepted your resignation.'}
          </p>
          {open.status === 'submitted' && (
            <SecondaryButton
              type="button"
              disabled={withdraw.isPending}
              onClick={async () => {
                const why = await promptDialog({
                  title: 'Withdraw your resignation?',
                  message: 'HR will see your reason.',
                  label: 'Reason',
                  required: true,
                  multiline: true,
                  confirmLabel: 'Withdraw',
                });
                if (why) withdraw.mutate({ id: open.id, reason: why });
              }}
            >
              Withdraw resignation
            </SecondaryButton>
          )}
        </section>
      ) : (
        <form
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const sure = await confirmDialog({
              title: 'Submit your resignation?',
              message:
                'HR will be notified and your notice period starts from the date you resign.',
              confirmLabel: 'Submit',
            });
            if (sure) submit.mutate();
          }}
        >
          <h2 className="text-base font-semibold text-gray-900">Resign</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="resign-date"
              label="Resignation date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              hint="Your notice starts at 30 days from this date; HR confirms the last day."
            />
            <SelectField
              id="resign-reason"
              label="Reason"
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value as (typeof RESIGNATION_REASONS)[number],
                )
              }
            >
              {RESIGNATION_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REASON_LABELS[value]}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <label
              htmlFor="resign-detail"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Details
            </label>
            <textarea
              id="resign-detail"
              required
              rows={4}
              maxLength={2000}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
            />
          </div>
          <Button type="submit" disabled={submit.isPending || !detail.trim()}>
            Submit resignation
          </Button>
        </form>
      )}

      {data.filter((r) => r.status === 'withdrawn').length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Withdrawn
          </h2>
          <ul className="space-y-1 text-sm text-gray-600">
            {data
              .filter((r) => r.status === 'withdrawn')
              .map((r) => (
                <li key={r.id}>
                  Resigned {dateLabel(r.resignationDate)} — withdrawn
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

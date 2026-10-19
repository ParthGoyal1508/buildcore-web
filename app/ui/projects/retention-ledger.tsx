'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getRetention, releaseRetention } from '@/app/lib/api/billing';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  projectErrorMessage,
  useProjectLock,
} from '@/app/ui/projects/project-lock-context';
import QueryError from '@/app/ui/query-error';
import { FieldLabelSpacer } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * What a work order still holds back, and recording money going back (025 FR-032).
 *
 * ## Three figures, not a balance
 *
 * Withheld, released and outstanding. A subcontractor asking "how much are you still holding" is
 * really asking "and how did it get to that"; a single number sends somebody to add up bills by
 * hand to answer the second half.
 *
 * **Withheld counts only bills that have left draft** — a draft is a working document and its
 * retention has been withheld from nobody.
 *
 * ## A release is an act, never a schedule
 *
 * The client chose this over two automatic schedules they were offered, and the reason holds: a
 * schedule guessed wrong does not fail loudly. It quietly withholds money that was due or releases
 * money that was not, and nobody notices until the subcontractor does.
 *
 * The date is the day the money went back, not the day somebody typed it in — a release entered a
 * fortnight late still belongs on the date it happened. Append-only: there is no edit, because the
 * row is the evidence that money moved.
 */
export default function RetentionLedger({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [releasedOn, setReleasedOn] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { isLocked } = useProjectLock();
  const toast = useToast();

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['retention', workOrderId],
    queryFn: () => getRetention(workOrderId),
  });

  const release = useMutation({
    mutationFn: () =>
      releaseRetention(workOrderId, {
        amount: Number(amount),
        releasedOn,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setError(null);
      toast.success('The release was recorded.');
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({
        queryKey: ['retention', workOrderId],
      });
    },
    // The server refuses more than the outstanding balance, and a release with nothing said about
    // it, each by its own code. Its sentence is the useful one. A 423 gets the lock sentence.
    onError: (err: Error) => setError(projectErrorMessage(err)),
  });

  // 036 I17 (2026-10-17): `isLoading || !data` held "Reading the retention…" for ever when the read
  // failed. A placeholder while it loads, the failure with a retry when it does not.
  if (isError) {
    return (
      <QueryError
        compact
        error={loadError}
        fallback="The retention could not be loaded."
        onRetry={refetch}
      />
    );
  }
  if (isLoading || !data) {
    return (
      <div
        role="status"
        aria-label="Reading the retention…"
        className="grid animate-pulse grid-cols-3 gap-3 rounded-md border border-gray-200 p-4"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Retention
      </h3>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Withheld</dt>
          <dd className="font-medium tabular-nums">{rupees(data.withheld)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Released</dt>
          <dd className="font-medium tabular-nums">{rupees(data.released)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Still held</dt>
          <dd className="font-medium tabular-nums">
            {rupees(data.outstanding)}
          </dd>
        </div>
      </dl>

      {data.releases.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {data.releases.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 py-1.5">
              <span className="text-gray-600">
                {dateLabel(row.releasedOn)} — {row.reason ?? ''}
              </span>
              <span className="tabular-nums">{rupees(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* `items-start`, not `items-end`: the date field carries a hint, and bottom-aligning the
          row pushed its input up while dropping every neighbouring label below it. */}
      {/* Absent on a locked project (036 Wave 3): the release is a write the server refuses 423. */}
      {!isLocked && (
      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          // Append-only — there is no edit or reversal — so it is confirmed first (036 Wave 3).
          if (
            !(await confirmDialog({
              title: 'Record this release?',
              message: `${rupees(Number(amount))} released on ${dateLabel(releasedOn)}. A release cannot be edited or removed afterwards.`,
              confirmLabel: 'Record',
            }))
          ) {
            return;
          }
          release.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Release</span>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-32 rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">On</span>
          <input
            type="date"
            required
            value={releasedOn}
            onChange={(event) => setReleasedOn(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <span className="text-xs text-gray-500">
            The day the money went back.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Against what</span>
          <input
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Defect liability period completed"
            className="w-72 rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <div>
          <FieldLabelSpacer />
          <Button type="submit" loading={release.isPending}>
            {release.isPending ? 'Recording…' : 'Record the release'}
          </Button>
        </div>
      </form>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

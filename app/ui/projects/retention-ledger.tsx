'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getRetention, releaseRetention } from '@/app/lib/api/billing';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';

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

  const { data, isLoading } = useQuery({
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
      setAmount('');
      setReason('');
      void queryClient.invalidateQueries({
        queryKey: ['retention', workOrderId],
      });
    },
    // The server refuses more than the outstanding balance, and a release with nothing said about
    // it, each by its own code. Its sentence is the useful one.
    onError: (err: Error) => setError(err.message),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500">Reading the retention…</p>;
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

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
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
        <div className="pb-1">
          <Button type="submit" disabled={release.isPending}>
            {release.isPending ? 'Recording…' : 'Record the release'}
          </Button>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

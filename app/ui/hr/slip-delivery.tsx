'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getSlipDeliveries,
  retrySlipDeliveries,
  sendSlipDeliveries,
  type SlipDeliveryRow,
  type SlipDeliveryStatus,
} from '@/app/lib/api/hr-payroll';
import { SLIP_DELIVERY_COPY } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Who has been emailed their payslip, and what to do about the ones who have not
 * (021 FR-006 to FR-009) — `bugs.md` item 8.
 *
 * ## Sending is an explicit action
 *
 * Not automatic. FR-005 reads as automatic delivery on payment and the client asked us to check
 * that; until they answer, this control is what exists — because an explicit send can be automated
 * later, whereas an automatic send that was wrong has already emailed five hundred people their
 * salary.
 *
 * ## "Retry failures" and "send" are not the same control
 *
 * They are twelve emails or five hundred, and they are rendered so they cannot be mistaken for each
 * other: the retry names its count, sits apart from the primary action, and is absent entirely when
 * nothing failed. The server enforces the distinction too — the retry queries `status: failed` — but
 * a screen offering an unlabelled "Retry" beside a "Send" is how somebody picks the wrong one.
 *
 * ## Four states, not two
 *
 * `undeliverable` is not a kind of failure: a failure is retried, an address-less row needs somebody
 * to find an address first, and a retry sweeping up both would keep failing on the same employees
 * forever. And `notAttempted` is not a failure either — "nobody has tried yet" sends a different
 * person to a different place than "it bounced".
 */
export default function SlipDelivery({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const deliveries = useQuery({
    queryKey: ['hr', 'slipDeliveries', runId],
    queryFn: () => getSlipDeliveries(runId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['hr', 'slipDeliveries', runId],
    });

  const send = useMutation({
    mutationFn: () => sendSlipDeliveries(runId),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    // The 409 from an unapproved run carries its own message naming the level it waits on. Shown
    // verbatim rather than replaced: FR-009 asks for the reason, and "could not send" is not one.
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : SLIP_DELIVERY_COPY.sendFailed,
      ),
  });

  const retry = useMutation({
    mutationFn: () => retrySlipDeliveries(runId),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : SLIP_DELIVERY_COPY.retryFailed,
      ),
  });

  if (deliveries.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {SLIP_DELIVERY_COPY.loading}
      </p>
    );
  }
  if (deliveries.isError || !deliveries.data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {SLIP_DELIVERY_COPY.loadFailed}
      </p>
    );
  }

  const summary = deliveries.data;
  const busy = send.isPending || retry.isPending;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            {SLIP_DELIVERY_COPY.heading}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {SLIP_DELIVERY_COPY.hint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              send.mutate();
            }}
          >
            {summary.sent > 0
              ? SLIP_DELIVERY_COPY.sendRemaining(summary.notAttempted)
              : SLIP_DELIVERY_COPY.send}
          </Button>
          {/*
            Absent when nothing failed, rather than disabled. A greyed "Retry 0 failures" is a
            control inviting a question, and the answer is that there is nothing to retry.
          */}
          {summary.failed > 0 && (
            <SecondaryButton
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                retry.mutate();
              }}
            >
              {/* Names the count, because the difference between this and Send is twelve emails
                  or five hundred. */}
              {SLIP_DELIVERY_COPY.retry(summary.failed)}
            </SecondaryButton>
          )}
        </div>
      </div>

      <FormError message={error} />

      {/*
        A run with some failures is **partial, not failed**. Failures are isolated by design — one
        bad address does not stop the other 499 — and a banner reading "delivery failed" invites
        somebody to send everything again.
      */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tally
          label={SLIP_DELIVERY_COPY.tally.sent}
          value={summary.sent}
          tone="good"
        />
        <Tally
          label={SLIP_DELIVERY_COPY.tally.failed}
          value={summary.failed}
          tone={summary.failed > 0 ? 'warn' : 'quiet'}
        />
        <Tally
          label={SLIP_DELIVERY_COPY.tally.undeliverable}
          value={summary.undeliverable}
          tone={summary.undeliverable > 0 ? 'warn' : 'quiet'}
        />
        <Tally
          label={SLIP_DELIVERY_COPY.tally.notAttempted}
          value={summary.notAttempted}
          tone="quiet"
        />
      </div>

      {summary.undeliverable > 0 && (
        <p
          className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {SLIP_DELIVERY_COPY.undeliverableHint}
        </p>
      )}

      {summary.rows.length === 0 ? (
        <p className="text-sm text-gray-700">{SLIP_DELIVERY_COPY.noneYet}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">
                  {SLIP_DELIVERY_COPY.columns.employee}
                </th>
                <th className="px-3 py-2">
                  {SLIP_DELIVERY_COPY.columns.address}
                </th>
                <th className="px-3 py-2">
                  {SLIP_DELIVERY_COPY.columns.status}
                </th>
                <th className="px-3 py-2">
                  {SLIP_DELIVERY_COPY.columns.detail}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">
                      {row.employeeName || row.employeeCode}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">
                      {row.employeeCode}
                    </span>
                  </td>
                  {/* The address as sent. See the schema's comment: showing the current one would
                      make an old failure read as though it went to the corrected address. */}
                  <td className="break-all px-3 py-2 text-gray-700">
                    {row.address || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {row.status === 'sent'
                      ? dateTimeLabel(row.sentAt)
                      : row.failureReason || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'warn' | 'quiet';
}) {
  const tones = {
    good: 'border-green-200 bg-green-50/60 text-green-900',
    warn: 'border-amber-200 bg-amber-50/60 text-amber-900',
    quiet: 'border-gray-200 bg-gray-50 text-gray-800',
  } as const;
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: SlipDeliveryStatus }) {
  const tones: Record<SlipDeliveryStatus, string> = {
    sent: 'bg-green-100 text-green-900',
    failed: 'bg-amber-100 text-amber-900',
    // Distinct from `failed`, visually as well as in words: these need a person, not a button.
    undeliverable: 'bg-red-100 text-red-900',
    pending: 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${tones[status]}`}
    >
      {SLIP_DELIVERY_COPY.statusLabels[status]}
    </span>
  );
}

export type { SlipDeliveryRow };

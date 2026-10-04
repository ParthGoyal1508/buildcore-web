'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  composeRaBill,
  getAward,
  reviseRaBill,
  type RaBill,
} from '@/app/lib/api/billing';
import { billTotals, lineTotals, retentionOn } from '@/app/lib/bill-totals';
import { BILLING_COPY } from '@/app/lib/constants';
import { rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The subcontractor RA bill sheet (018 US2, FR-007 to FR-009 — `bugs.md` item 12).
 *
 * ## Three quantities, before anybody types (FR-007)
 *
 * Awarded, measured to date, and remaining. The server supplies all three, so the biller never has
 * to work the remainder out from a column they cannot see.
 *
 * ## Each deduction in its own right (FR-008)
 *
 * Gross, retention with its basis, advance recovery, other deductions, net payable — five figures,
 * never one net with the arithmetic hidden. **The basis is what makes a deduction arguable rather
 * than merely imposed**: a subcontractor disputing a payment asks which deduction accounts for the
 * difference, and a single `netPayable` cannot answer.
 *
 * ## Revising a certified bill warns first (FR-009, T027–T029)
 *
 * The warning is the requirement. It appears **before** the edit — not after, and not as a toast
 * once the save has already withdrawn somebody's certification. And the confirmation afterwards does
 * **not** claim the invalidation has completed: the spine's completion event is fire-and-forget and
 * feature 016 established that a chain restarts when a correction is applied rather than when it is
 * asked for, so this says the queue may take a moment rather than asserting a state it cannot see.
 */
export default function RaBillSheet({
  projectId,
  workOrderId,
  /** When present, this sheet revises that bill rather than composing a new one. */
  revising,
}: {
  projectId: string;
  workOrderId: string;
  revising?: RaBill;
}) {
  const queryClient = useQueryClient();
  const award = useQuery({
    // The bill being revised is excluded from its own to-date figure, or reducing a quantity on a
    // fully-measured award is refused for exceeding the award it is reducing.
    queryKey: ['raAward', workOrderId, revising?.id ?? null],
    queryFn: () => getAward(workOrderId, revising?.id),
  });

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (revising?.lines ?? []).map((line) => [
        line.workOrderBoqItemId,
        line.thisPeriodQty,
      ]),
    ),
  );
  const [billNumber, setBillNumber] = useState(revising?.billNumber ?? '');
  const [billingDate, setBillingDate] = useState(
    revising ? revising.billingDate.slice(0, 10) : todayIso(),
  );
  const [advanceRecovery, setAdvanceRecovery] = useState(
    revising ? String(revising.advanceRecovery) : '',
  );
  const [otherDeductions, setOtherDeductions] = useState(
    revising ? String(revising.otherDeductions) : '',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** A rejected save caused by somebody else's change (FR-014). Nothing typed is discarded. */
  const [conflict, setConflict] = useState(false);

  const setQuantity = useCallback((id: string, value: number) => {
    setQuantities((previous) => {
      const next = { ...previous };
      if (value > 0) next[id] = value;
      else delete next[id];
      return next;
    });
  }, []);

  const lines = award.data?.lines ?? [];
  const measured = lines.filter((line) => (quantities[line.workOrderBoqItemId] ?? 0) > 0);

  const perLine = measured.map((line) =>
    lineTotals({
      quantity: quantities[line.workOrderBoqItemId] ?? 0,
      rate: line.rate,
      previouslyBilledQty: line.toDateQty,
      scopeQty: line.awardedQty,
    }),
  );
  const retentionFraction = award.data?.retentionPercent ?? 0;
  const grossOnly = billTotals(perLine);
  const totals = billTotals(perLine, {
    retention: retentionOn(grossOnly.gross, retentionFraction),
    advanceRecovery: advanceRecovery ? Number(advanceRecovery) : 0,
    other: otherDeductions ? Number(otherDeductions) : 0,
  });
  const overAward = perLine.some((line) => line.exceedsScope);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        lines: Object.entries(quantities).map(([id, quantity]) => ({
          workOrderBoqItemId: id,
          quantity,
        })),
        advanceRecovery: advanceRecovery ? Number(advanceRecovery) : undefined,
        otherDeductions: otherDeductions ? Number(otherDeductions) : undefined,
      };
      return revising
        ? reviseRaBill(revising.id, { ...payload, reason: reason.trim() })
        : composeRaBill({
            ...payload,
            projectId,
            workOrderId,
            billNumber: billNumber.trim(),
            billingDate,
          });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['raBills', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['raAward', workOrderId] });
      // Not "the approval has been invalidated" — see the class comment. The queue is eventual.
      setDone(revising ? BILLING_COPY.reviseDone : null);
      if (!revising) {
        setQuantities({});
        setBillNumber('');
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
        setError(err.message);
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : revising
            ? BILLING_COPY.reviseFailed
            : BILLING_COPY.composeFailed,
      );
    },
  });

  if (award.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {BILLING_COPY.boqLoading}
      </p>
    );
  }
  if (award.isError || !award.data) {
    return <FormError message={BILLING_COPY.boqLoadFailed} />;
  }
  if (lines.length === 0) {
    return <p className="text-sm text-gray-600">{BILLING_COPY.raEmpty}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {revising ? BILLING_COPY.reviseHeading : BILLING_COPY.raHeading}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{BILLING_COPY.raHint}</p>
      </div>

      {/*
        The warning comes before the edit, which is the requirement itself (FR-009). A certified
        bill and a pending one are different warnings: one withdraws a signature, the other
        replaces a request nobody has answered.
      */}
      {revising && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          {revising.status === 'approved'
            ? BILLING_COPY.reviseWarning
            : BILLING_COPY.reviseWarningPending}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-[48rem] w-full">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-2 py-2">{BILLING_COPY.raColumns.description}</th>
              <th className="px-2 py-2">{BILLING_COPY.raColumns.unit}</th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.awardedQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.toDateQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.remainingQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.rate}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.thisPeriodQty}
              </th>
              <th className="px-2 py-2 text-right">
                {BILLING_COPY.raColumns.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const entered = quantities[line.workOrderBoqItemId] ?? 0;
              const totalsForLine = lineTotals({
                quantity: entered,
                rate: line.rate,
                previouslyBilledQty: line.toDateQty,
                scopeQty: line.awardedQty,
              });
              return (
                <tr
                  key={line.workOrderBoqItemId}
                  className={clsx(
                    'border-b border-gray-100',
                    totalsForLine.exceedsScope && 'bg-amber-50',
                  )}
                >
                  <td className="px-2 py-1.5 text-sm text-gray-900">
                    {line.description}
                  </td>
                  <td className="px-2 py-1.5 text-sm text-gray-600">
                    {line.unit}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-gray-600">
                    {line.awardedQty}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-gray-600">
                    {line.toDateQty}
                  </td>
                  <td
                    className={clsx(
                      'px-2 py-1.5 text-right text-sm tabular-nums',
                      totalsForLine.remainingQty < 0
                        ? 'font-medium text-amber-900'
                        : 'text-gray-600',
                    )}
                  >
                    {totalsForLine.remainingQty}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-gray-600">
                    {rupees(line.rate)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${BILLING_COPY.raColumns.thisPeriodQty} — ${line.description}`}
                      value={entered === 0 ? '' : String(entered)}
                      onChange={(event) =>
                        setQuantity(
                          line.workOrderBoqItemId,
                          Number(event.target.value) || 0,
                        )
                      }
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm font-medium tabular-nums text-gray-900">
                    {entered > 0 ? rupees(totalsForLine.amount) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {overAward && (
        <p className="text-sm text-amber-900" role="alert">
          {BILLING_COPY.exceedsAward}
        </p>
      )}

      {/* FR-008: five figures, each in its own right, each with its basis. */}
      <dl className="space-y-1 rounded border border-gray-200 p-3 text-sm sm:max-w-md">
        <Figure label={BILLING_COPY.gross} value={totals.gross} />
        <Figure
          label={BILLING_COPY.retention}
          value={totals.retention}
          basis={BILLING_COPY.retentionBasis(
            `${(retentionFraction * 100).toFixed(2)}%`,
          )}
        />
        <Figure
          label={BILLING_COPY.advanceRecovery}
          value={totals.advanceRecovery}
          basis={BILLING_COPY.advanceRecoveryBasis}
        />
        <Figure
          label={BILLING_COPY.otherDeductions}
          value={totals.otherDeductions}
        />
        <Figure
          label={BILLING_COPY.deductionTotal}
          value={totals.deductionTotal}
        />
        <Figure label={BILLING_COPY.netPayable} value={totals.net} strong />
        <p className="pt-1 text-xs text-gray-500">
          {BILLING_COPY.deductionsAreNotCost}
        </p>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!revising && (
          <>
            <TextField
              id="ra-bill-number"
              label={BILLING_COPY.billNumberLabel}
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
            />
            <TextField
              id="ra-billing-date"
              type="date"
              label={BILLING_COPY.billingDateLabel}
              value={billingDate}
              onChange={(event) => setBillingDate(event.target.value)}
            />
          </>
        )}
        <TextField
          id="ra-advance-recovery"
          type="number"
          step="0.01"
          min="0"
          label={BILLING_COPY.advanceRecovery}
          value={advanceRecovery}
          onChange={(event) => setAdvanceRecovery(event.target.value)}
        />
        <TextField
          id="ra-other-deductions"
          type="number"
          step="0.01"
          min="0"
          label={BILLING_COPY.otherDeductions}
          value={otherDeductions}
          onChange={(event) => setOtherDeductions(event.target.value)}
        />
      </div>

      {revising && (
        <TextField
          id="ra-revise-reason"
          label={BILLING_COPY.reviseReasonLabel}
          hint={BILLING_COPY.reviseReasonHint}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      )}

      {conflict && (
        <div
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-amber-900">
            {BILLING_COPY.conflictHeading}
          </p>
          <p className="mt-1 text-amber-900">{BILLING_COPY.conflictHint}</p>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
            <SecondaryButton type="button" onClick={() => setConflict(false)}>
              {BILLING_COPY.conflictKeep}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['raAward', workOrderId],
                });
                setConflict(false);
              }}
            >
              {BILLING_COPY.conflictReload}
            </SecondaryButton>
          </div>
        </div>
      )}

      <FormError message={error} />
      {done && (
        <p className="text-sm text-green-800" role="status">
          {done}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          disabled={
            measured.length === 0 ||
            save.isPending ||
            (revising ? reason.trim().length < 3 : !billNumber.trim())
          }
          onClick={() => {
            setError(null);
            setDone(null);
            save.mutate();
          }}
        >
          {save.isPending
            ? revising
              ? BILLING_COPY.revising
              : BILLING_COPY.composing
            : revising
              ? BILLING_COPY.revise
              : BILLING_COPY.compose}
        </Button>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  basis,
  strong = false,
}: {
  label: string;
  value: number;
  basis?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-600">
        {label}
        {/* The basis, beside the figure. A deduction whose basis is hidden is imposed. */}
        {basis && <span className="block text-xs text-gray-500">{basis}</span>}
      </dt>
      <dd
        className={
          strong
            ? 'font-semibold tabular-nums text-gray-900'
            : 'tabular-nums text-gray-900'
        }
      >
        {rupees(value)}
      </dd>
    </div>
  );
}

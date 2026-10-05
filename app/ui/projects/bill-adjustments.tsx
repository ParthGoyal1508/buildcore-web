'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  BILL_ADJUSTMENTS,
  BILL_ADJUSTMENT_TOTALS,
  type BillAbstract,
  type BillAdjustmentKey,
  setBillAdjustments,
} from '@/app/lib/api/bill-packages';
import { Button } from '@/app/ui/button';

/**
 * The month's recoveries, deductions and withholdings (025 FR-044).
 *
 * ## What this replaces
 *
 * Nothing. Every one of these columns was read by the abstract, printed on the workbook and the
 * PDF, and carried into the next bill's cumulative position — and settable nowhere. A bill went out
 * with a *Recovery of Diesel* row that could only ever say zero, and a debit raised and applied
 * showed in the register without moving the payable by a rupee.
 *
 * ## The debit total is shown, not applied
 *
 * Which bucket a debit belongs in is a judgement — diesel drawn, a civil debit, a mechanical one —
 * so the register's total sits beside the recovery fields rather than filling one of them in. A
 * figure that changed by itself when somebody applied a debit elsewhere would be a figure nobody
 * could stand behind at a certification meeting.
 *
 * ## Only what changed is sent
 *
 * The server leaves an omitted column alone and sets one sent as `0`. Posting the whole set every
 * time would make "I did not touch that" indistinguishable from "set it to nothing", on columns
 * that are money.
 */
export default function BillAdjustments({
  packageId,
  abstract,
  debitTotal,
  onSaved,
}: {
  packageId: string;
  abstract: BillAbstract;
  /** What the applied debits on this bill come to, for comparison. Null while unknown. */
  debitTotal: string | null;
  onSaved: () => void;
}) {
  const stored = (key: string): string => {
    const value = (abstract.columns.thisBill as Record<string, unknown>)[key];
    return value == null ? '' : String(value);
  };

  const [edits, setEdits] = useState<Partial<Record<BillAdjustmentKey, string>>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => setBillAdjustments(packageId, edits),
    onSuccess: () => {
      setError(null);
      setEdits({});
      onSaved();
    },
    onError: (err: unknown) =>
      setError(
        (err as { message?: string })?.message ??
          'Those figures were refused and the server gave no reason.',
      ),
  });

  const field = (key: BillAdjustmentKey, label: string) => (
    <label key={key} className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        value={edits[key] ?? stored(key)}
        onChange={(event) =>
          setEdits((current) => ({ ...current, [key]: event.target.value }))
        }
        className="w-36 rounded-md border border-gray-300 px-2 py-1 text-right tabular-nums"
      />
    </label>
  );

  const blocks = [
    { id: 'A', title: 'Withheld', note: 'Beside the work done, before tax.' },
    {
      id: 'B',
      title: 'Recoveries',
      note: 'What the company recovers out of this bill.',
    },
    {
      id: 'C',
      title: 'Deductions',
      note: 'Held back under the contract, not recovered against work.',
    },
  ];

  return (
    <section className="rounded-md border border-gray-200 p-4">
      <h3 className="mb-1 font-medium text-gray-900">
        Recoveries and deductions
      </h3>
      <p className="mb-4 text-sm text-gray-600">
        The figures a person decides, as distinct from the ones a rate produces.{' '}
        <strong>Retention and TDS are not here</strong> — both are computed from
        this bill&apos;s own frozen rates, and a bill stating a retention its
        rate does not produce is a bill nobody can check.
      </p>

      {debitTotal != null && (
        <p className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          Debits applied to this bill total <strong>{debitTotal}</strong>. Which
          recovery line they belong under is your call, so nothing is filled in
          from them — this is here to compare against.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {blocks.map((block) => (
          <div key={block.id} className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {block.title}
            </h4>
            {BILL_ADJUSTMENTS.filter((row) => row.block === block.id).map(
              (row) => field(row.key, row.label),
            )}
            <p className="mt-1 text-xs text-gray-500">{block.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contract totals
        </h4>
        <p className="mb-2 text-xs text-gray-500">
          What each one-time recovery comes to in total. Without it, a deduction
          that is fully recovered and one somebody entered as zero this month are
          the same row.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BILL_ADJUSTMENT_TOTALS.map((row) =>
            field(
              row.key,
              `${
                BILL_ADJUSTMENTS.find((a) => a.key === row.of)?.label ?? row.of
              } — total`,
            ),
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          disabled={save.isPending || Object.keys(edits).length === 0}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save figures'}
        </Button>
        {Object.keys(edits).length > 0 && (
          <span className="text-xs text-gray-500">
            {Object.keys(edits).length} changed — only those are sent.
          </span>
        )}
      </div>
    </section>
  );
}

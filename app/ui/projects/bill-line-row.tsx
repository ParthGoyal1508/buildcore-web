'use client';

import clsx from 'clsx';
import { memo, useEffect, useRef, useState } from 'react';

import { BILLING_COPY } from '@/app/lib/constants';
import { lineTotals } from '@/app/lib/bill-totals';
import { rupees } from '@/app/lib/format';

/**
 * One measurable line, **owning its own value** (018 T010, NFR-001).
 *
 * ## This is the architecture, not a detail
 *
 * A single form object holding 500 lines re-renders the whole sheet on every keystroke. On the
 * client's own BOQ — 312 lines, of which 229 are measurable — that is several hundred input elements
 * reconciled per character typed, and the symptom is not a crash: it is a biller whose typing lags
 * half a second behind their fingers, down a column, for an afternoon. They stop using the screen and
 * go back to the spreadsheet, which is where this feature started.
 *
 * So the typed value lives **here**, in this row's own state, and the parent is told only when the
 * value settles. `memo` then means a keystroke in row 40 re-renders row 40.
 *
 * The React Profiler check in quickstart Scenario 2 step 3 is how this is verified rather than
 * assumed: if a keystroke re-renders more than its own row, this is not actually in place.
 *
 * ## Why the row computes its own total
 *
 * It reads `lineTotals` from `app/lib/bill-totals.ts` — the same pure function the bill total and the
 * server both use. Computing it here is what lets the row show the line amount without a parent
 * re-render; reading it from one shared place is what stops this screen and the composed bill
 * disagreeing about what a line came to.
 */
export interface BillLineRowProps {
  id: string;
  boqNo: string;
  taskName: string;
  unit: string;
  scopeQty: number;
  rate: number;
  /** The rate is still 0: the line cannot be billed, and the row says so. */
  unpriced: boolean;
  previouslyBilledQty: number;
  isVariation: boolean;
  variationRef: string | null;
  /** The quoted excess as a fraction, applied to the line amount. */
  quotedPercentage: number;
  /**
   * The value this row starts from, if a draft was restored.
   *
   * Read **once**, at mount. A restored draft arrives after the first render, and syncing it into
   * this row's state in an effect would be a second source of truth for what is in the input —
   * which is how a late-loading draft comes to overwrite what somebody is already typing. The sheet
   * instead remounts the rows by changing their `key`, which is the only way to replace row state
   * without also being able to clobber it.
   */
  initialQuantity?: number;
  initialReason?: string;
  /** Called when the value settles — on blur and on Enter, not on every keystroke. */
  onQuantityChange: (id: string, quantity: number) => void;
  onReasonChange: (id: string, reason: string) => void;
  /** Focus the next row's input (FR-004). Supplied by the sheet, which knows the order. */
  onEnterNext: (id: string) => void;
  /** Registers this row's input so the sheet can move focus into it. */
  registerInput: (id: string, element: HTMLInputElement | null) => void;
  readOnly?: boolean;
}

function BillLineRowImpl({
  id,
  boqNo,
  taskName,
  unit,
  scopeQty,
  rate,
  unpriced,
  previouslyBilledQty,
  isVariation,
  variationRef,
  quotedPercentage,
  initialQuantity,
  initialReason,
  onQuantityChange,
  onReasonChange,
  onEnterNext,
  registerInput,
  readOnly = false,
}: BillLineRowProps) {
  const [raw, setRaw] = useState(
    initialQuantity && initialQuantity > 0 ? String(initialQuantity) : '',
  );
  const [reason, setReason] = useState(initialReason ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    registerInput(id, inputRef.current);
    return () => registerInput(id, null);
  }, [id, registerInput]);

  const quantity = Number(raw) || 0;
  const totals = lineTotals(
    { quantity, rate, previouslyBilledQty, scopeQty },
    quotedPercentage,
  );

  const settle = () => onQuantityChange(id, quantity);

  return (
    <tr
      className={clsx(
        'border-b border-gray-100',
        totals.exceedsScope && 'bg-amber-50',
        unpriced && 'bg-gray-50',
      )}
    >
      <td className="px-2 py-1.5 align-top font-mono text-xs text-gray-600">
        {boqNo}
      </td>
      <td className="px-2 py-1.5 align-top text-sm text-gray-900">
        {taskName}
        {isVariation && (
          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            {variationRef ? `Variation ${variationRef}` : 'Variation'}
          </span>
        )}
        {unpriced && (
          <span
            className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700"
            title={BILLING_COPY.unpricedHint}
          >
            {BILLING_COPY.unpriced}
          </span>
        )}
        {/*
          The reason sits under the line it belongs to rather than in a dialog at submit time: the
          person who knows why a measurement went past the contract is the person typing it, at the
          moment they type it.
        */}
        {totals.exceedsScope && !readOnly && (
          <div className="mt-1">
            <label
              htmlFor={`reason-${id}`}
              className="block text-xs font-medium text-amber-900"
            >
              {BILLING_COPY.overQuantityReasonLabel}
            </label>
            <input
              id={`reason-${id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => onReasonChange(id, reason)}
              className="mt-0.5 w-full rounded border border-amber-300 px-2 py-1 text-xs"
            />
            <p className="mt-0.5 text-xs text-amber-800">
              {BILLING_COPY.overQuantityHint}
            </p>
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 align-top text-sm text-gray-600">{unit}</td>
      <td className="px-2 py-1.5 align-top text-right text-sm tabular-nums text-gray-600">
        {scopeQty}
      </td>
      <td className="px-2 py-1.5 align-top text-right text-sm tabular-nums text-gray-600">
        {previouslyBilledQty}
      </td>
      <td
        className={clsx(
          'px-2 py-1.5 align-top text-right text-sm tabular-nums',
          totals.remainingQty < 0 ? 'font-medium text-amber-900' : 'text-gray-600',
        )}
      >
        {totals.remainingQty}
      </td>
      <td className="px-2 py-1.5 align-top text-right text-sm tabular-nums text-gray-600">
        {unpriced ? '—' : rupees(rate)}
      </td>
      <td className="px-2 py-1.5 align-top text-right">
        {readOnly ? (
          <span className="text-sm tabular-nums text-gray-900">{quantity}</span>
        ) : (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            value={raw}
            disabled={unpriced}
            aria-label={`${BILLING_COPY.columns.quantity} — ${boqNo}`}
            onChange={(event) => setRaw(event.target.value)}
            onBlur={settle}
            onKeyDown={(event) => {
              // FR-004: Enter settles this line and moves down the column. A biller works a
              // schedule top to bottom and reaching for the mouse between every line is the
              // difference between using this screen and using a spreadsheet.
              if (event.key === 'Enter') {
                event.preventDefault();
                settle();
                onEnterNext(id);
              }
            }}
            className={clsx(
              'w-24 rounded border px-2 py-1 text-right text-sm tabular-nums',
              totals.exceedsScope
                ? 'border-amber-400 bg-white'
                : 'border-gray-300',
              unpriced && 'cursor-not-allowed bg-gray-100',
            )}
          />
        )}
      </td>
      <td className="px-2 py-1.5 align-top text-right text-sm font-medium tabular-nums text-gray-900">
        {quantity > 0 ? rupees(totals.amount) : '—'}
      </td>
    </tr>
  );
}

/**
 * `memo` is what makes the per-row state worth having.
 *
 * Without it the parent's own re-render (a bill total changing, a draft loading) would re-render
 * every row anyway, and the row-local state would buy nothing. The props are all primitives and
 * stable callbacks, so the default shallow comparison is the right one — which is why the sheet
 * holds its callbacks in refs rather than re-creating them each render.
 */
const BillLineRow = memo(BillLineRowImpl);
export default BillLineRow;

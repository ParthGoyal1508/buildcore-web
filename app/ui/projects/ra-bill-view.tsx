'use client';

import { useState } from 'react';

import { type RaBill } from '@/app/lib/api/billing';
import { BILLING_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';

/**
 * One subcontractor bill, read-only (027).
 *
 * ## Why reading needed its own surface
 *
 * The only thing you could do with a bill was open it for editing. Looking at what was billed meant
 * opening the sheet that changes it — and on a submitted bill, reading past a warning about
 * replacing an approval request to find out what the figures were. "Show me this bill" is the most
 * ordinary question asked of one and it had no answer that did not involve the edit path.
 *
 * ## It fetches nothing
 *
 * `getRaBills` returns each bill through `RaBillsService.view`, so the list already carries every
 * line and every deduction. A detail fetch here would be a second request for bytes already in
 * memory — and a second chance for the two to disagree about one bill.
 *
 * ## Each deduction in its own right (FR-008)
 *
 * Gross, retention, advance recovery, other deductions, net payable — never one net with the
 * arithmetic hidden. **The basis is what makes a deduction arguable rather than merely imposed**: a
 * subcontractor disputing a payment asks which deduction accounts for the difference, and a single
 * `netPayable` cannot answer. The same reason the sheet shows them separately while composing.
 */
export default function RaBillView({ bill }: { bill: RaBill }) {
  const [showAllLines, setShowAllLines] = useState(false);

  /**
   * What this bill measured. A package-composed bill carries a line for **every** award line,
   * because 023's measurement sheet has to let a claim be made against any of them — so a bill
   * measuring two items can arrive holding sixty rows, of which fifty-eight are the award.
   *
   * `!== 0` rather than `> 0`: a negative correction is still a line this bill acted on.
   */
  const measured = bill.lines.filter(
    (line) => Number(line.thisPeriodQty) !== 0,
  );
  const hidden = bill.lines.length - measured.length;
  const lines = showAllLines ? bill.lines : measured;

  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <p className="text-xs text-gray-500">
        {`${bill.billNumber} · ${dateLabel(bill.billingDate)}`}
        {bill.description ? ` · ${bill.description}` : ''}
      </p>

      {/* Three states, not two: a bill with no lines at all, a bill whose lines all carry
          nothing, and a bill to render. Collapsing the middle one into the first would tell a
          reader the lines were removed when they are sitting right there at zero. */}
      {bill.lines.length === 0 ? (
        <p className="text-sm text-gray-600">{BILLING_COPY.viewNoLines}</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-gray-600">
          {BILLING_COPY.nothingBilledOnThisBill}
        </p>
      ) : (
        /* Scrolls inside itself, so a long description never widens the page around it. */
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-2 py-2">
                  {BILLING_COPY.viewColumns.description}
                </th>
                <th className="px-2 py-2">{BILLING_COPY.viewColumns.unit}</th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.viewColumns.quantity}
                </th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.viewColumns.rate}
                </th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.viewColumns.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-900">
                    {line.description}
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">{line.unit}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                    {/* What this bill measured — not the to-date figure, which belongs to the
                        sheet where somebody is deciding what to add to it. */}
                    {line.thisPeriodQty}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                    {rupees(line.rate)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                    {rupees(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 && (
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-xs text-gray-500">
            {BILLING_COPY.linesHidden(hidden, measured.length)}
          </p>
          <button
            type="button"
            onClick={() => setShowAllLines((current) => !current)}
            className="text-xs font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {showAllLines
              ? BILLING_COPY.showBilledLines
              : BILLING_COPY.showAllLines}
          </button>
        </div>
      )}

      <dl className="max-w-sm space-y-1 rounded border border-gray-200 p-3 text-sm">
        <Line label={BILLING_COPY.gross} value={bill.grossAmount} />
        <Line
          label={BILLING_COPY.retention}
          value={bill.retentionAmount}
          muted
        />
        <Line
          label={BILLING_COPY.advanceRecovery}
          value={bill.advanceRecovery}
          muted
        />
        <Line
          label={BILLING_COPY.otherDeductions}
          value={bill.otherDeductions}
          muted
        />
        <Line
          label={BILLING_COPY.deductionTotal}
          value={bill.deductionTotal}
          muted
        />
        <Line label={BILLING_COPY.netPayable} value={bill.netPayable} strong />
        <p className="pt-1 text-xs text-gray-500">
          {BILLING_COPY.deductionsAreNotCost}
        </p>
      </dl>
    </div>
  );
}

function Line({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: string;
  /** Null where the figure is not yet settled — see `BILLING_COPY.netNotYetSettled`. */
  value: number | null;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-gray-600' : 'text-gray-900'}>{label}</dt>
      <dd
        className={
          strong
            ? 'font-semibold tabular-nums text-gray-900'
            : 'tabular-nums text-gray-900'
        }
      >
        {value === null ? (
          <span className="text-sm font-normal text-gray-500">
            {BILLING_COPY.netNotYetSettled}
          </span>
        ) : (
          rupees(value)
        )}
      </dd>
    </div>
  );
}

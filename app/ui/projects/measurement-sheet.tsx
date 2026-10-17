'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { getMeasurementSheet } from '@/app/lib/api/bill-packages';
import { dateLabel } from '@/app/lib/format';
import QueryError from '@/app/ui/query-error';
import { TABLE } from '@/app/ui/table';

/**
 * The shared table look at sheet density (2026-10-15): this reads like the printed measurement
 * sheet, and px-4 py-3 spreads nineteen bills over a screen. `!` because clsx does not drop
 * TABLE's own padding. The tables sit inside this card, so they scroll without a second border.
 */
const DENSE_TH = clsx(TABLE.th, '!px-3 !py-2');
const DENSE_TD = clsx(TABLE.td, '!px-3 !py-2');

/**
 * One schedule line's measurement sheet, on screen (025 FR-028).
 *
 * ## Why this is worth a screen when the workbook already has it
 *
 * The workbook has nineteen of these and is downloaded to be signed. This is what somebody opens to
 * answer one question — *where did 0.700 come from?* — without producing a document. The two layers
 * are the whole answer:
 *
 * **The claim history across bills**, which is where the argument lives. The Remarks column is not
 * decoration: *"30% deduction — shoulder slope, supervisor labour, staff not available"* is the case
 * for a reduction, written by the engineer who made it, and it is reproduced verbatim because it is
 * the thing the document exists to settle.
 *
 * **The daily record beneath it**, where a day with no logbook entry reads as **missing** rather
 * than as a run of zeroes. An unrecorded day and a day the machine did nothing are different facts,
 * and only one of them is somebody to go and ask.
 *
 * ## The footer is an identity, not a summary
 *
 * This bill plus up to previous equals up to date, exactly, and the middle figure names the bill it
 * was read from so a reviewer can go and check it rather than taking it.
 */
export default function MeasurementSheet({
  packageId,
  scheduleLineId,
}: {
  packageId: string;
  scheduleLineId: string;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['measurement-sheet', packageId, scheduleLineId],
    queryFn: () => getMeasurementSheet(packageId, scheduleLineId),
  });

  if (isLoading) {
    return (
      <p className="p-3 text-sm text-gray-500" role="status">
        Loading the measurement sheet…
      </p>
    );
  }
  // 036 I17 (2026-10-17): the failure with a retry, not a dead end.
  if (isError || !data) {
    return (
      <QueryError
        compact
        className="m-3"
        error={error}
        fallback="That measurement sheet could not be read."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
      <header>
        <h3 className="text-sm font-semibold text-gray-900">
          {data.boqNo} — {data.description}
        </h3>
        <p className="text-xs text-gray-500">
          {data.billLabel} · quantities in {data.unit}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className={TABLE.table}>
          <caption className="sr-only">Claimed across bills</caption>
          <thead className={TABLE.thead}>
            <tr>
              <th className={DENSE_TH}>Bill</th>
              <th className={DENSE_TH}>Period</th>
              <th className={clsx(DENSE_TH, 'text-right')}>Qty</th>
              <th className={DENSE_TH}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((row) => (
              <tr
                key={`${row.billLabel}-${row.periodFrom}`}
                className={clsx(TABLE.row, row.isThisBill && 'bg-brand-50')}
              >
                <td className={clsx(DENSE_TD, 'whitespace-nowrap')}>
                  {row.billLabel}
                  {row.overClaimed && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                      over
                    </span>
                  )}
                </td>
                <td
                  className={clsx(DENSE_TD, 'whitespace-nowrap text-gray-600')}
                >
                  {dateLabel(row.periodFrom)} – {dateLabel(row.periodTo)}
                </td>
                <td className={clsx(DENSE_TD, TABLE.numeric)}>
                  {row.quantity}
                </td>
                {/* Verbatim. This is the argument for a deduction, written by the engineer who
                    made it, and tidying it would be editing somebody's case. */}
                <td
                  className={clsx(DENSE_TD, 'max-w-md text-xs text-gray-700')}
                >
                  {row.reason ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className={TABLE.tfoot}>
            <tr>
              <td className={DENSE_TD} colSpan={2}>
                This bill
              </td>
              <td className={clsx(DENSE_TD, TABLE.numeric)}>
                {data.footer.thisBillQty}
              </td>
              <td className={DENSE_TD} />
            </tr>
            <tr>
              <td className={clsx(DENSE_TD, 'text-gray-600')} colSpan={2}>
                Upto previous
                {data.footer.uptoPreviousFrom && (
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    (read from {data.footer.uptoPreviousFrom})
                  </span>
                )}
              </td>
              <td className={clsx(DENSE_TD, TABLE.numeric)}>
                {data.footer.uptoPreviousQty}
              </td>
              <td className={DENSE_TD} />
            </tr>
            <tr>
              <td className={DENSE_TD} colSpan={2}>
                Upto date
              </td>
              <td className={clsx(DENSE_TD, TABLE.numeric)}>
                {data.footer.uptoDateQty}
              </td>
              <td className={DENSE_TD} />
            </tr>
          </tfoot>
        </table>
      </div>

      {data.dailyRecord.length > 0 && (
        <div className="overflow-x-auto">
          <table className={TABLE.table}>
            <caption className="py-1 text-left text-xs uppercase tracking-wide text-gray-500">
              The daily record
            </caption>
            <thead className={TABLE.thead}>
              <tr>
                <th className={DENSE_TH}>Date</th>
                <th className={clsx(DENSE_TH, 'text-right')}>Start</th>
                <th className={clsx(DENSE_TH, 'text-right')}>End</th>
                <th className={clsx(DENSE_TH, 'text-right')}>Run</th>
                <th className={DENSE_TH}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.dailyRecord.map((day) => (
                <tr key={day.date} className={TABLE.row}>
                  <td className={clsx(DENSE_TD, 'whitespace-nowrap')}>
                    {dateLabel(day.date)}
                  </td>
                  {day.logbookMissing ? (
                    // Not zeroes. A day nobody logged and a day the machine did nothing are
                    // different facts, and only one of them is somebody to go and ask.
                    <td
                      className={clsx(DENSE_TD, 'text-xs text-gray-500')}
                      colSpan={3}
                    >
                      no logbook entry for this day
                    </td>
                  ) : (
                    <>
                      <td className={clsx(DENSE_TD, TABLE.numeric)}>
                        {day.openingReading ?? '—'}
                      </td>
                      <td className={clsx(DENSE_TD, TABLE.numeric)}>
                        {day.closingReading ?? '—'}
                      </td>
                      <td className={clsx(DENSE_TD, TABLE.numeric)}>
                        {day.totalHours ?? '—'}
                      </td>
                    </>
                  )}
                  <td
                    className={clsx(DENSE_TD, 'max-w-md text-xs text-gray-700')}
                  >
                    {day.remarks ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/app/lib/api/client';
import {
  getDrillDown,
  type DrillableFigure,
} from '@/app/lib/api/project-pnl';
import { PNL_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';

/**
 * What a figure on the project summary is made of (018 FR-011, FR-012).
 *
 * ## Four answers, and none of them is a zero
 *
 * This is the whole design. Opening a figure can end in four different places, and the screen keeps
 * them apart because a reader acts differently on each:
 *
 *   1. **Records.** The rows, and a total summed from them by the server, so the rows add up to the
 *      figure they were opened from.
 *   2. **Nothing in the period.** A real, empty answer.
 *   3. **Cannot be itemised** — the module reports a period total without listing what is inside it.
 *      The figure on the summary is still measured; only the itemisation is missing.
 *   4. **Not permitted.** A 403 from the server. Said plainly, because an empty drill-down reads as
 *      "there is nothing there" (the spec's edge case) and that is a different and misleading claim.
 *
 * An empty list for cases 3 and 4 would be the same mistake `unavailableCategories` exists to avoid
 * one level up, arriving by a different route.
 *
 * ## The total is checked against the figure it was opened from
 *
 * If the records do not come to the figure, this says so rather than quietly showing two numbers and
 * letting the reader decide which is wrong. A drill-down that nearly adds up is worse than none.
 */
export default function PnlDrillDown({
  projectId,
  period,
  figure,
  label,
  /** The figure on the summary, so the records can be checked against it. */
  expected,
  scope = 'month',
}: {
  projectId: string;
  period: string;
  figure: DrillableFigure;
  label: string;
  expected: number;
  scope?: 'month' | 'cumulative';
}) {
  const drill = useQuery({
    queryKey: ['pnlDrillDown', projectId, period, figure, scope],
    queryFn: () => getDrillDown(projectId, period, figure, scope),
    retry: false,
  });

  if (drill.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {PNL_COPY.drillLoading}
      </p>
    );
  }

  if (drill.isError) {
    // A 403 is not a failure to load — it is an answer, and saying "could not open" instead would
    // send somebody to report a bug about a rule working as intended.
    const refused =
      drill.error instanceof ApiError && drill.error.status === 403;
    return (
      <p
        className={refused ? 'text-sm text-gray-700' : 'text-sm text-red-700'}
        role={refused ? undefined : 'alert'}
      >
        {refused ? PNL_COPY.drillRefused : PNL_COPY.drillFailed}
      </p>
    );
  }

  const view = drill.data;
  if (!view) return null;

  if (view.records === null) {
    return (
      <div className="space-y-1 text-sm text-gray-700">
        <p>{view.unavailableReason ?? PNL_COPY.drillNotItemised}</p>
      </div>
    );
  }
  if (view.records.length === 0) {
    return <p className="text-sm text-gray-600">{PNL_COPY.drillEmpty}</p>;
  }

  const total = view.total ?? 0;
  const difference = Math.round((expected - total) * 100) / 100;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">
        {PNL_COPY.drillHeading(label)}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-gray-600">
            <tr>
              <th className="py-1 pr-3">{PNL_COPY.drillColumns.reference}</th>
              <th className="py-1 pr-3">{PNL_COPY.drillColumns.date}</th>
              <th className="py-1 pr-3 text-right">
                {PNL_COPY.drillColumns.amount}
              </th>
              <th className="py-1 pr-3">{PNL_COPY.drillColumns.status}</th>
            </tr>
          </thead>
          <tbody>
            {view.records.map((record) => (
              <tr key={record.id} className="border-t border-gray-100">
                <td className="py-1 pr-3 text-gray-900">
                  {record.reference}
                  {record.description && (
                    <span className="block text-xs text-gray-500">
                      {record.description}
                    </span>
                  )}
                </td>
                <td className="py-1 pr-3 text-gray-600">
                  {dateLabel(record.date)}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums text-gray-900">
                  {rupees(record.amount)}
                </td>
                <td className="py-1 pr-3 text-gray-600">
                  {record.status ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td className="py-1 pr-3 font-medium text-gray-900" colSpan={2}>
                {PNL_COPY.drillTotal}
              </td>
              <td className="py-1 pr-3 text-right font-semibold tabular-nums text-gray-900">
                {rupees(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {difference === 0 ? (
        <p className="text-xs text-gray-500">{PNL_COPY.drillReconciles}</p>
      ) : (
        <p className="text-xs font-medium text-amber-900" role="alert">
          {PNL_COPY.drillDiffers(rupees(difference))}
        </p>
      )}
      {view.itemisedFurtherAt && (
        <p className="text-xs text-gray-500">
          A fuller breakdown is available for this figure — see the labour
          register below.
        </p>
      )}
    </div>
  );
}

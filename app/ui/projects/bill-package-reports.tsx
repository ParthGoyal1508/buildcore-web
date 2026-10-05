'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getOverClaimReport,
  getUnderstatementReport,
} from '@/app/lib/api/bill-packages';
import { dateLabel } from '@/app/lib/format';

/**
 * The two reports feature 023's decisions oblige (025 FR-031).
 *
 * ## Why each exists, which is also why an unread one is worthless
 *
 * **Understatement** exists because freezing a bill's figures at issue makes it possible for a
 * daily work report approved *late* to belong to a period already billed. The work was done, the
 * measurement is approved, and the bill that should have carried it has gone. Nothing detects that
 * except a comparison nobody runs, so the report states the difference per line and says what to do
 * about it — a report without a remedy is a complaint.
 *
 * **Over-claims** exist because the decision to permit an over-claim was made on the condition that
 * each one carries a reason and that the reasons are counted. A reason nobody aggregates is a reason
 * nobody reads, and a count with no denominator cannot be read as a pattern: three over-claims out
 * of four lines and three out of three hundred are different bills.
 *
 * Both endpoints have existed since 023, with a test each, and no caller.
 */
export default function BillPackageReports({
  projectId,
}: {
  projectId: string;
}) {
  const understatement = useQuery({
    queryKey: ['understatement', projectId],
    queryFn: () => getUnderstatementReport(projectId),
  });
  const overClaims = useQuery({
    queryKey: ['over-claims', projectId],
    queryFn: () => getOverClaimReport(projectId),
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            Billed less than was approved
          </h2>
          <p className="text-sm text-gray-600">
            A bill freezes its figures when it is issued. A daily work report
            approved after that can belong to a period already billed — the work
            happened, the measurement stands, and the bill that should have
            carried it has gone out. Nothing finds that except this comparison.
          </p>
        </header>

        {understatement.isLoading ? (
          <p className="text-sm text-gray-500">Comparing…</p>
        ) : !understatement.data ? (
          <p className="text-sm text-red-700">The report could not be read.</p>
        ) : understatement.data.rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            Every issued bill still matches the measurement approved for its
            period. Compared across{' '}
            {understatement.data.comparableDirections.join(' and ') || 'no'}{' '}
            direction(s).
          </p>
        ) : (
          understatement.data.rows.map((row) => (
            <div
              key={row.packageId}
              className="rounded-md border border-amber-200 bg-amber-50 p-3"
            >
              <p className="text-sm font-medium text-amber-900">
                {row.label} · {dateLabel(row.periodFrom)} –{' '}
                {dateLabel(row.periodTo)}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
                {row.lines.map((line) => (
                  <li key={line.boqItemId}>
                    {line.boqNo}: billed {line.claimed}, approved{' '}
                    {line.approvedNow} — short by{' '}
                    <strong>{line.understatedBy}</strong>
                  </li>
                ))}
              </ul>
              {/* The remedy is the server's, stated per bill. A report that names a problem and
                  leaves the reader to invent the fix is a report people stop opening. */}
              <p className="mt-2 text-xs text-amber-900">{row.remedy}</p>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-lg font-semibold text-gray-900">
            Claimed more than was measured
          </h2>
          <p className="text-sm text-gray-600">
            An over-claim is permitted, with a written reason. Permitted on the
            condition that somebody counts them — and a count needs its
            denominator: three out of four lines and three out of three hundred
            are different bills.
          </p>
        </header>

        {overClaims.isLoading ? (
          <p className="text-sm text-gray-500">Counting…</p>
        ) : !overClaims.data ? (
          <p className="text-sm text-red-700">The report could not be read.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Bill</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2 text-right">Over-claimed</th>
                  <th className="px-3 py-2">Lines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overClaims.data.rows.map((row) => (
                  <tr key={row.packageId}>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-gray-600">{row.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.overClaimedCount} of {row.lineCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {row.lines.map((line) => line.boqNo).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

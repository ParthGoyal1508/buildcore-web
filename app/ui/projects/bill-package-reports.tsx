'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import {
  type OverClaimReport,
  getOverClaimReport,
  getUnderstatementReport,
} from '@/app/lib/api/bill-packages';
import { projectsLabel } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { TABLE } from '@/app/ui/table';

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
            period.{' '}
            {understatement.data.comparableDirections.length === 0
              ? 'No direction had anything to compare.'
              : `Compared across: ${understatement.data.comparableDirections
                  .map(projectsLabel)
                  .join(' and ')}.`}
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
                    {line.approvedNow} — still short by{' '}
                    <strong>{line.understatedBy}</strong>
                    {line.recoveredLater && Number(line.recoveredLater) > 0 && (
                      <span className="text-amber-800">
                        {' '}
                        ({line.recoveredLater} already claimed back on a later
                        bill)
                      </span>
                    )}
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
          <OverClaims report={overClaims.data} />
        )}
      </section>
    </div>
  );
}

/**
 * Over-claims with their reasons, and reversals after issue.
 *
 * Bills with nothing over-claimed are summed into the denominator rather than listed one per row:
 * a table of "0 of 120" rows hid the few that mattered.
 */
function OverClaims({ report }: { report: OverClaimReport }) {
  const flagged = report.rows.filter((row) => row.overClaimedCount > 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-700">
        <strong>{report.totalOverClaimed}</strong> over-claimed line
        {report.totalOverClaimed === 1 ? '' : 's'} out of {report.totalLines}{' '}
        across {report.rows.length} bill{report.rows.length === 1 ? '' : 's'}.
      </p>

      {flagged.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          No bill has claimed more than its approved measurement.
        </p>
      ) : (
        // The shared look but no sorting (2026-10-15): each bill's lines are grouped under its
        // label, written once on the first line, and a sort would scatter them across bills.
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Bill</th>
                <th className={TABLE.th}>State</th>
                <th className={TABLE.th}>Item</th>
                <th className={clsx(TABLE.th, 'text-right')}>Measured</th>
                <th className={clsx(TABLE.th, 'text-right')}>Claimed</th>
                <th className={TABLE.th}>Reason given</th>
              </tr>
            </thead>
            <tbody>
              {flagged.flatMap((row) =>
                row.lines.map((line, index) => (
                  <tr
                    key={`${row.packageId}-${line.boqNo}-${index}`}
                    className={TABLE.row}
                  >
                    <td className={clsx(TABLE.td, 'align-top')}>
                      {index === 0 ? (
                        <>
                          {row.label}
                          <span className="block text-xs text-gray-500">
                            {row.overClaimedCount} of {row.lineCount} lines
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td className={clsx(TABLE.td, 'align-top text-gray-600')}>
                      {index === 0 ? projectsLabel(row.status) : null}
                    </td>
                    <td className={TABLE.td}>{line.boqNo || '—'}</td>
                    <td className={clsx(TABLE.td, TABLE.numeric)}>
                      {line.proposed ?? '—'}
                    </td>
                    <td
                      className={clsx(TABLE.td, TABLE.numeric, 'font-medium')}
                    >
                      {line.claimed}
                    </td>
                    <td className={clsx(TABLE.td, 'text-gray-700')}>
                      {line.reason ?? '—'}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {report.reversedAfterIssue.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Measurement reduced after the bill went out
          </h3>
          <p className="text-sm text-gray-600">
            These bills claimed what was approved at the time; the approved
            measurement for their period has since been reduced. They now claim
            more than was measured. Recover the difference on the next bill to
            this client, or record a revision.
          </p>
          {report.reversedAfterIssue.map((row) => (
            <div
              key={row.packageId}
              className="rounded-md border border-red-200 bg-red-50 p-3"
            >
              <p className="text-sm font-medium text-red-900">
                {row.label} · {dateLabel(row.periodFrom)} –{' '}
                {dateLabel(row.periodTo)}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-red-900">
                {row.lines.map((line) => (
                  <li key={line.boqNo}>
                    {line.boqNo}: billed {line.claimed}, now approved{' '}
                    {line.approvedNow} — over by <strong>{line.overBy}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

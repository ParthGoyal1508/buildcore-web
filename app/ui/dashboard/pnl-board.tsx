'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import { getPnlGroup } from '@/app/lib/api/project-pnl';
import { getProjects } from '@/app/lib/api/projects';
import { PNL_COPY, ROUTES } from '@/app/lib/constants';
import { currentPeriod, rupees } from '@/app/lib/format';

/**
 * Every project's position side by side, with the company total (018 US4, FR-013).
 *
 * ## The total is the sum of the rows, and the rows are what the viewer may see
 *
 * Both halves matter. The server sums the rows it returned, so the figure a reader checks by hand is
 * the figure shown; and a project the viewer may not see is absent from the rows, so it is absent
 * from the total. A total computed by a separate aggregate query would **leak the existence** of the
 * projects it included — the same disclosure rule 021's cross-register search works under — and
 * would be the classic reconciliation failure besides: a company total that does not equal the sum of
 * the projects on the same screen, after which neither figure can be trusted.
 *
 * `boardTotalNote` says this on the screen rather than leaving it to be inferred.
 *
 * ## Pleasant on a phone, not merely unbroken (NFR-003)
 *
 * This is the one screen in feature 018 that a director might genuinely read on a phone, and the
 * spec says so. So below `md` it is **cards**, not a table in a horizontal scroller: a director
 * holding a phone one-handed should not have to scroll sideways to find the margin, which is the
 * only column they came for. The margin is therefore first on the card and largest.
 */
export default function PnlBoard() {
  const [period, setPeriod] = useState(currentPeriod);

  // Every project the viewer may see — the visibility filter is the server's, applied to this list
  // and inherited by the board. Asking for a page of 200 rather than paging: a company's project
  // count is in the tens, and a paged total would be a total of one page.
  const projects = useQuery({
    queryKey: ['projects', 'pnl-board'],
    queryFn: () => getProjects({ pageSize: 200 }),
  });

  const ids = (projects.data?.items ?? []).map((project) => project.id);

  const board = useQuery({
    queryKey: ['pnlGroup', ids, period],
    queryFn: () => getPnlGroup(ids, period),
    enabled: ids.length > 0,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {PNL_COPY.boardHeading}
        </h2>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            {PNL_COPY.monthLabel}
          </span>
          <input
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            // 44px below `sm`: a director changing the month on a phone is the use this screen was
            // named for.
            className="min-h-11 w-full rounded border border-gray-300 px-2 py-1 text-sm sm:min-h-0 sm:w-auto"
          />
        </label>
      </div>

      {(projects.isLoading || board.isLoading) && (
        <p className="text-sm text-gray-500" role="status">
          {PNL_COPY.boardLoading}
        </p>
      )}
      {(projects.isError || board.isError) && (
        <p className="text-sm text-red-700" role="alert">
          {PNL_COPY.boardLoadFailed}
        </p>
      )}

      {board.data && board.data.rows.length === 0 && (
        <p className="text-sm text-gray-600">{PNL_COPY.boardEmpty}</p>
      )}

      {board.data && board.data.rows.length > 0 && (
        <>
          {/* Cards below md — see the class comment. Margin first, because it is the column. */}
          <ul className="space-y-3 md:hidden">
            {board.data.rows.map((row) => (
              <li
                key={row.projectId}
                className="rounded border border-gray-200 p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={ROUTES.projectsSummary(row.projectId)}
                    className="min-h-11 text-sm font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    {row.projectName}
                  </Link>
                  <span
                    className={clsx(
                      'text-lg font-semibold tabular-nums',
                      row.marginCumulative < 0
                        ? 'text-red-700'
                        : 'text-gray-900',
                    )}
                  >
                    {rupees(row.marginCumulative)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">
                      {PNL_COPY.boardColumns.revenue}
                    </dt>
                    <dd className="tabular-nums text-gray-900">
                      {rupees(row.revenueCumulative)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">
                      {PNL_COPY.boardColumns.cost}
                    </dt>
                    <dd className="tabular-nums text-gray-900">
                      {rupees(row.costCumulative)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
            <li className="rounded border border-gray-300 bg-gray-50 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900">
                  {PNL_COPY.boardTotal}
                </span>
                <span
                  className={clsx(
                    'text-lg font-semibold tabular-nums',
                    board.data.totals.marginCumulative < 0
                      ? 'text-red-700'
                      : 'text-gray-900',
                  )}
                >
                  {rupees(board.data.totals.marginCumulative)}
                </span>
              </div>
            </li>
          </ul>

          <div className="hidden overflow-x-auto rounded border border-gray-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-2">{PNL_COPY.boardColumns.project}</th>
                  <th className="px-3 py-2 text-right">
                    {PNL_COPY.boardColumns.revenue}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {PNL_COPY.boardColumns.cost}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {PNL_COPY.boardColumns.margin}
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {board.data.rows.map((row) => (
                  <tr key={row.projectId} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-900">
                      {row.projectName}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                      {rupees(row.revenueCumulative)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                      {rupees(row.costCumulative)}
                    </td>
                    <td
                      className={clsx(
                        'px-3 py-2 text-right font-medium tabular-nums',
                        row.marginCumulative < 0
                          ? 'text-red-700'
                          : 'text-gray-900',
                      )}
                    >
                      {rupees(row.marginCumulative)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={ROUTES.projectsSummary(row.projectId)}
                        className="text-sm text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        {PNL_COPY.boardOpen}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300 bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {PNL_COPY.boardTotal}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                    {rupees(board.data.totals.revenueCumulative)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                    {rupees(board.data.totals.costCumulative)}
                  </td>
                  <td
                    className={clsx(
                      'px-3 py-2 text-right font-semibold tabular-nums',
                      board.data.totals.marginCumulative < 0
                        ? 'text-red-700'
                        : 'text-gray-900',
                    )}
                  >
                    {rupees(board.data.totals.marginCumulative)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-500">{PNL_COPY.boardTotalNote}</p>
          {board.data.unavailableCategories.length > 0 && (
            <p className="text-sm text-amber-900">
              {PNL_COPY.unavailableHint(
                board.data.unavailableCategories
                  .map((category) => PNL_COPY.categories[category] ?? category)
                  .join(', '),
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

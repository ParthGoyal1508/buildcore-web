'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import { getPnlGroup, type PnlGroup } from '@/app/lib/api/project-pnl';
import { getProjects } from '@/app/lib/api/projects';
import { PNL_COPY, ROUTES } from '@/app/lib/constants';
import { currentPeriod, rupees } from '@/app/lib/format';
import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortableColumn,
} from '@/app/ui/table';

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
            className="h-11 w-full rounded border border-gray-300 px-3 text-sm sm:h-10 sm:w-auto"
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
                    className="min-h-11 text-sm font-medium text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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

          <PnlTable board={board.data} />

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

type BoardRow = PnlGroup['rows'][number];

// The raw figures sort the money columns; the cells below render them (2026-10-15).
const BOARD_COLUMNS: SortableColumn<BoardRow>[] = [
  { key: 'projectName', render: (row) => row.projectName },
  { key: 'revenueCumulative', render: (row) => row.revenueCumulative },
  { key: 'costCumulative', render: (row) => row.costCumulative },
  { key: 'marginCumulative', render: (row) => row.marginCumulative },
];

/** The desktop table, sortable by any column; the company total stays in the footer. */
function PnlTable({ board }: { board: PnlGroup }) {
  const { sorted, sort, toggle } = useSortedRows(board.rows, BOARD_COLUMNS);
  const header = (key: string, label: string, numeric = false) => (
    <SortHeader
      label={label}
      columnKey={key}
      sort={sort}
      onSort={toggle}
      numeric={numeric}
    />
  );
  return (
    <div className={clsx(TABLE.wrap, 'hidden md:block')}>
      <table className={clsx(TABLE.table, 'w-full')}>
        <thead className={TABLE.thead}>
          <tr>
            {header('projectName', PNL_COPY.boardColumns.project)}
            {header('revenueCumulative', PNL_COPY.boardColumns.revenue, true)}
            {header('costCumulative', PNL_COPY.boardColumns.cost, true)}
            {header('marginCumulative', PNL_COPY.boardColumns.margin, true)}
            <th className={TABLE.th} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.projectId} className={TABLE.row}>
              <td className={clsx(TABLE.td, 'text-gray-900')}>
                {row.projectName}
              </td>
              <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
                {rupees(row.revenueCumulative)}
              </td>
              <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
                {rupees(row.costCumulative)}
              </td>
              <td
                className={clsx(
                  TABLE.td,
                  TABLE.numeric,
                  'font-medium',
                  row.marginCumulative < 0 ? 'text-red-700' : 'text-gray-900',
                )}
              >
                {rupees(row.marginCumulative)}
              </td>
              <td className={clsx(TABLE.td, 'text-right')}>
                <Link
                  href={ROUTES.projectsSummary(row.projectId)}
                  className="text-sm text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {PNL_COPY.boardOpen}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className={TABLE.tfoot}>
          <tr>
            <td className={clsx(TABLE.td, 'text-gray-900')}>
              {PNL_COPY.boardTotal}
            </td>
            <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
              {rupees(board.totals.revenueCumulative)}
            </td>
            <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
              {rupees(board.totals.costCumulative)}
            </td>
            <td
              className={clsx(
                TABLE.td,
                TABLE.numeric,
                board.totals.marginCumulative < 0
                  ? 'text-red-700'
                  : 'text-gray-900',
              )}
            >
              {rupees(board.totals.marginCumulative)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

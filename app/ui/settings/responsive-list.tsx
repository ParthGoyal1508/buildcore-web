'use client';

import clsx from 'clsx';
import { Fragment } from 'react';

import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import {
  SortHeader,
  TABLE,
  useTableSort,
  type SortValue,
  type TableSort,
} from '@/app/ui/table';

/**
 * One column definition, rendered twice: as a `<td>` on desktop and as a labelled
 * row inside a card on mobile.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Kept off the mobile card when the value is noise at that size. */
  hideOnCard?: boolean;
  className?: string;
  /** What the column sorts by when it is not what it shows; see `app/ui/table.tsx`. */
  sortValue?: (row: T) => SortValue;
  /** `false` where there is nothing to order by. */
  sortable?: boolean;
}

/**
 * The list pattern every Settings screen uses (research.md §7).
 *
 * A table below `md` would either scroll horizontally or crush its columns, and the
 * product's primary users are on phones in the field (Constitution VI), so the same
 * column definitions render as stacked cards there instead — one definition, two
 * presentations, no chance of the two drifting apart.
 *
 * Since 2026-10-15 the desktop table shares its look with every other table (`TABLE` in
 * `app/ui/table.tsx`) and its headers sort the loaded rows on a click; the cards follow the same
 * order.
 *
 * 036 A4, A13–A16 — all optional, so the 68 existing callers render as before apart from the
 * skeleton and the error box:
 * - `onRetry` puts a Retry button on the error (pass the query's `refetch`); `error` may be the
 *   query's error object itself, and its server message is shown.
 * - Loading draws `skeletonRows` placeholder rows under the real headers instead of one line.
 * - `serverPaged` turns header sorting off (it only ever sorted the visible page); `sort` +
 *   `onSortChange` sort on the server instead — keep the sort in `useUrlState` and send it.
 * - `isRefreshing` dims the rows while a new page or filter loads. Pair it with React Query's
 *   `placeholderData: keepPreviousData`, which keeps the old rows on screen meanwhile, so the table
 *   does not flash empty between pages: `isRefreshing={query.isPlaceholderData}`.
 */
export default function ResponsiveList<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  actions,
  detail,
  emptyMessage = 'Nothing here yet.',
  isLoading = false,
  error,
  onRetry,
  skeletonRows = 5,
  sort,
  onSortChange,
  serverPaged = false,
  isRefreshing = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /**
   * Where a click on the row goes, for a list whose only link is in its actions (2026-10-15):
   * the whole row opens it (`RowLinks`).
   */
  rowHref?: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
  /**
   * Extra content belonging to one row, given the full width beneath it (016 FR-009a).
   *
   * **Always rendered, never toggled.** There is no expander and no stored open/closed state, and
   * that is the point rather than an omission: the first caller is the employee's own attendance,
   * where an administrator's change to their day must not be dismissable or clearable. A component
   * that could hide it would be one `localStorage` key away from hiding it permanently.
   *
   * Return `null` for a row with nothing to add and no space is taken.
   */
  detail?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  /** A message, or the query's error itself (its server message is shown). */
  error?: unknown;
  /** Adds Retry to the error state. */
  onRetry?: () => unknown;
  skeletonRows?: number;
  /** Server-side sort: the current sort, and where a header click sends the next one. */
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  /** The rows are one page of a server-paged list: header sorting is off unless `onSortChange`. */
  serverPaged?: boolean;
  /** A new page or filter is loading over the rows shown. */
  isRefreshing?: boolean;
}) {
  const {
    sorted,
    sort: activeSort,
    toggle,
    enabled: sortEnabled,
  } = useTableSort(rows, columns, { sort, onSortChange, serverPaged });
  if (isLoading) {
    const headers = columns.map((column) => column.header);
    return (
      <div role="status">
        <span className="sr-only">Loading…</span>
        <ListSkeleton
          headers={headers}
          rows={skeletonRows}
          cards
          className="md:hidden"
        />
        <ListSkeleton
          headers={headers}
          rows={skeletonRows}
          actions={Boolean(actions)}
          className="hidden md:block"
        />
      </div>
    );
  }
  if (error) {
    return typeof error === 'string' ? (
      <QueryError message={error} onRetry={onRetry} />
    ) : (
      <QueryError error={error} onRetry={onRetry} />
    );
  }
  if (rows.length === 0) {
    return <p className={TABLE.empty}>{emptyMessage}</p>;
  }

  return (
    <div
      aria-busy={isRefreshing || undefined}
      className={clsx(isRefreshing && 'opacity-60 transition-opacity')}
    >
      {/* Mobile: one card per row. */}
      <div className="space-y-3 md:hidden">
        {sorted.map((row) => (
          <div
            key={rowKey(row)}
            data-row-href={rowHref?.(row)}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnCard)
                .map((column) => (
                  <div key={column.key} className="flex justify-between gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {column.header}
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
            </dl>
            {detail?.(row) && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                {detail(row)}
              </div>
            )}
            {actions && (
              <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: the same columns as a table. */}
      <div className={clsx(TABLE.wrap, 'hidden md:block')}>
        <table className={TABLE.table}>
          <thead className={TABLE.thead}>
            <tr>
              {columns.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.header}
                  columnKey={column.key}
                  sort={activeSort}
                  onSort={toggle}
                  sortable={sortEnabled && column.sortable !== false}
                  className={column.className}
                />
              ))}
              {actions && (
                <th scope="col" className={TABLE.th}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const rowDetail = detail?.(row);
              return (
                // Fragment keyed rather than the `<tr>`: a row with detail is two sibling rows,
                // and a table body admits nothing between them to group with.
                <Fragment key={rowKey(row)}>
                  <tr
                    data-row-href={rowHref?.(row)}
                    className={clsx(
                      TABLE.row,
                      // The border moves to the detail row when there is one, so the pair reads
                      // as one row rather than as a row and an orphan beneath it.
                      rowDetail && 'border-b-0',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={clsx(TABLE.td, column.className)}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                    {actions && (
                      <td className={TABLE.td} data-row-actions>
                        <div className="flex justify-end gap-2">
                          {actions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                  {rowDetail && (
                    <tr className="border-b border-gray-100 last:border-0">
                      <td
                        colSpan={columns.length + (actions ? 1 : 0)}
                        className="px-3 pb-3"
                      >
                        {rowDetail}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

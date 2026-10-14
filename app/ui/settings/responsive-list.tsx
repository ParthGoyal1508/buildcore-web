'use client';

import clsx from 'clsx';
import { Fragment } from 'react';

import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortValue,
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
 */
export default function ResponsiveList<T>({
  columns,
  rows,
  rowKey,
  actions,
  detail,
  emptyMessage = 'Nothing here yet.',
  isLoading = false,
  error,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
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
  error?: string | null;
}) {
  const { sorted, sort, toggle } = useSortedRows(rows, columns);
  if (isLoading) {
    return (
      <p className={TABLE.empty} role="status">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className={TABLE.failed} role="alert">
        {error}
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className={TABLE.empty}>{emptyMessage}</p>;
  }

  return (
    <div>
      {/* Mobile: one card per row. */}
      <div className="space-y-3 md:hidden">
        {sorted.map((row) => (
          <div
            key={rowKey(row)}
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
                  sort={sort}
                  onSort={toggle}
                  sortable={column.sortable !== false}
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
                      <td className={TABLE.td}>
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

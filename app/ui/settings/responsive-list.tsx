'use client';

import clsx from 'clsx';
import { Fragment } from 'react';

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
}

/**
 * The list pattern every Settings screen uses (research.md §7).
 *
 * A table below `md` would either scroll horizontally or crush its columns, and the
 * product's primary users are on phones in the field (Constitution VI), so the same
 * column definitions render as stacked cards there instead — one definition, two
 * presentations, no chance of the two drifting apart.
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
  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="rounded-lg bg-gray-50 p-2 md:p-4">
      {/* Mobile: one card per row. */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-md bg-white p-4 shadow-sm">
            <dl className="space-y-2">
              {columns
                .filter((column) => !column.hideOnCard)
                .map((column) => (
                  <div key={column.key} className="flex justify-between gap-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {column.header}
                    </dt>
                    <dd className="text-sm text-gray-900">{column.render(row)}</dd>
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
      <table className="hidden min-w-full text-gray-900 md:table">
        <thead className="text-left text-sm font-normal">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx('px-3 py-4 font-medium', column.className)}
              >
                {column.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-3 py-4 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((row) => {
            const rowDetail = detail?.(row);
            return (
              // Fragment keyed rather than the `<tr>`: a row with detail is two sibling rows, and
              // a table body admits nothing between them to group with.
              <Fragment key={rowKey(row)}>
                <tr
                  className={clsx(
                    'w-full py-3 text-sm',
                    // The border moves to the detail row when there is one, so the pair reads as
                    // one row rather than as a row and an orphan beneath it.
                    rowDetail ? 'border-none' : 'border-b last-of-type:border-none',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={clsx('px-3 py-3', column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
                {rowDetail && (
                  <tr className="border-b text-sm last-of-type:border-none">
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
  );
}

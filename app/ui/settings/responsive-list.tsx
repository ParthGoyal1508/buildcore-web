'use client';

import clsx from 'clsx';

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
  emptyMessage = 'Nothing here yet.',
  isLoading = false,
  error,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
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
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="w-full border-b py-3 text-sm last-of-type:border-none"
            >
              {columns.map((column) => (
                <td key={column.key} className={clsx('px-3 py-3', column.className)}>
                  {column.render(row)}
                </td>
              ))}
              {actions && (
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

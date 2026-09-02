'use client';

import clsx from 'clsx';

import { STATUS_BADGE_CLASSES, hrLabel } from '@/app/lib/constants';

/**
 * One column. `numeric` right-aligns and applies tabular figures, which is what
 * makes a column of money readable as a column rather than as ragged text.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  numeric?: boolean;
  className?: string;
  /** Kept visible while the rest of the table scrolls sideways. */
  sticky?: boolean;
}

/**
 * The list pattern every HR & Payroll screen uses.
 *
 * Deliberately **not** `ResponsiveList`. Constitution VI (as amended v2.0.0) makes
 * these desktop surfaces, and explicitly allows a horizontally-scrolling table in
 * its own container instead of a card fallback — which is the right answer here,
 * because the salary register and the attendance sheet are read *across* the row.
 * Turning eighteen columns into eighteen stacked label/value pairs destroys the
 * comparison the screen exists to support.
 *
 * What the amendment still requires, and what this component guarantees: the
 * overflow lives on this container, so the **page body never scrolls sideways**,
 * and the table stays usable down to a tablet width. The first column can be made
 * sticky so the reader never loses track of whose row they are on while scrolled
 * right.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  emptyMessage = 'Nothing here yet.',
  isLoading = false,
  error,
  footer,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
  error?: string | null;
  /** A totals row, rendered in `<tfoot>` so it stays associated with the table. */
  footer?: React.ReactNode;
  caption?: string;
}) {
  if (isLoading) {
    return (
      <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    // The scroll container. `tabIndex` and the role make it reachable by keyboard:
    // a scrollable region that only a mouse can pan is unusable for anyone
    // navigating by keyboard, and the columns off the right edge would simply be
    // unreachable for them.
    <div
      className="overflow-x-auto rounded-lg border border-gray-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      tabIndex={0}
      role="region"
      aria-label={caption ?? 'Data table'}
    >
      <table className="min-w-full text-sm text-gray-900">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-gray-200 bg-gray-50 text-left">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'whitespace-nowrap px-3 py-3 font-medium text-gray-700',
                  column.numeric && 'text-right tabular-nums',
                  column.sticky && 'sticky left-0 z-10 bg-gray-50',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-3 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-gray-100 last:border-none hover:bg-gray-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx(
                    'px-3 py-2.5 align-middle',
                    column.numeric && 'text-right tabular-nums',
                    column.sticky && 'sticky left-0 z-10 bg-white',
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
              {actions && (
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-2">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-medium">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * A status pill.
 *
 * Colour is never the only signal — the label is always rendered too, so the
 * badge carries the same information to a reader who cannot distinguish the
 * background colours.
 */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-gray-400">—</span>;
  return (
    <span
      className={clsx(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_BADGE_CLASSES[status] ?? 'bg-gray-100 text-gray-700',
      )}
    >
      {hrLabel(status)}
    </span>
  );
}

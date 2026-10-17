'use client';

import clsx from 'clsx';

import { HR_STATUS_TONES, hrLabel } from '@/app/lib/constants';
import QueryError from '@/app/ui/query-error';
import SharedStatusBadge from '@/app/ui/status-badge';
import { ListSkeleton } from '@/app/ui/skeletons';
import {
  SortHeader,
  TABLE,
  useTableSort,
  type SortValue,
  type TableSort,
} from '@/app/ui/table';

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
  /** What the column sorts by when it is not what it shows; see `app/ui/table.tsx`. */
  sortValue?: (row: T) => SortValue;
  /** `false` where there is nothing to order by. */
  sortable?: boolean;
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
 *
 * Since 2026-10-15 it shares its look with every other table (`TABLE` in `app/ui/table.tsx`) and
 * its headers sort the loaded rows on a click.
 *
 * 036 A4, A13–A16: `onRetry`, `skeletonRows`, `sort`/`onSortChange`, `serverPaged` and
 * `isRefreshing`, exactly as on `ResponsiveList` — see the note there.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  actions,
  emptyMessage = 'Nothing here yet.',
  isLoading = false,
  error,
  footer,
  caption,
  onRetry,
  skeletonRows = 5,
  sort,
  onSortChange,
  serverPaged = false,
  isRefreshing = false,
  stickyHeader = false,
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
  emptyMessage?: string;
  isLoading?: boolean;
  /** A message, or the query's error itself (its server message is shown). */
  error?: unknown;
  /** A totals row, rendered in `<tfoot>` so it stays associated with the table. */
  footer?: React.ReactNode;
  caption?: string;
  /** Adds Retry to the error state. */
  onRetry?: () => unknown;
  skeletonRows?: number;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  serverPaged?: boolean;
  isRefreshing?: boolean;
  /**
   * Keeps the header row in view while a long table scrolls (036 F9, F20). The table gets its own
   * vertical scroll — capped at most of the viewport — because a sticky header inside a container
   * that scrolls sideways can only stick to that container, never to the page.
   */
  stickyHeader?: boolean;
}) {
  const {
    sorted,
    sort: activeSort,
    toggle,
    enabled: sortEnabled,
  } = useTableSort(rows, columns, { sort, onSortChange, serverPaged });
  if (isLoading) {
    return (
      <div role="status">
        <span className="sr-only">Loading…</span>
        <ListSkeleton
          headers={columns.map((column) => column.header)}
          rows={skeletonRows}
          actions={Boolean(actions)}
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
    // The scroll container. `tabIndex` and the role make it reachable by keyboard:
    // a scrollable region that only a mouse can pan is unusable for anyone
    // navigating by keyboard, and the columns off the right edge would simply be
    // unreachable for them.
    <div
      className={clsx(
        TABLE.wrap,
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
        isRefreshing && 'opacity-60 transition-opacity',
        stickyHeader && 'max-h-[70vh] overflow-y-auto',
      )}
      aria-busy={isRefreshing || undefined}
      tabIndex={0}
      role="region"
      aria-label={caption ?? 'Data table'}
    >
      <table className={TABLE.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead
          className={clsx(TABLE.thead, stickyHeader && 'sticky top-0 z-20')}
        >
          <tr>
            {columns.map((column) => (
              <SortHeader
                key={column.key}
                label={column.header}
                columnKey={column.key}
                sort={activeSort}
                onSort={toggle}
                sortable={sortEnabled && column.sortable !== false}
                numeric={column.numeric}
                className={clsx(
                  column.sticky && 'sticky left-0 z-10 bg-gray-50',
                  column.className,
                )}
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
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className={TABLE.row}
              data-row-href={rowHref?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx(
                    TABLE.td,
                    column.numeric && TABLE.numeric,
                    column.sticky && TABLE.stickyCell,
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
              {actions && (
                <td className={TABLE.td} data-row-actions>
                  <div className="flex justify-end gap-2">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className={TABLE.tfoot}>{footer}</tfoot>}
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
  // The shared badge since 036 A21, with HR's own tone per status and HR's own wording — the same
  // shape, dot and ring as every other status in the app instead of a flatter copy of them.
  if (!status) return <span className="text-gray-500">—</span>;
  return (
    <SharedStatusBadge
      status={status}
      tone={HR_STATUS_TONES[status] ?? 'neutral'}
      label={hrLabel(status)}
    />
  );
}

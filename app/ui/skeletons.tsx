import clsx from 'clsx';

import { TABLE } from '@/app/ui/table-classes';

const BAR_WIDTHS = ['w-24', 'w-32', 'w-16', 'w-20', 'w-28', 'w-14'];

/**
 * The page skeleton's table: the loaded table's own card, header band and rows, with bars where
 * the text will be. The tutorial's row skeleton it was built from — an avatar circle and two
 * 38px icon squares per row, a shape no table here has — is gone (036 A16).
 */
export function TableSkeleton() {
  const columns = ['w-20', 'w-28', 'w-14', 'w-14', 'w-10'];
  return (
    <div className={clsx(TABLE.wrap, 'mt-6')} aria-hidden="true">
      <table className={TABLE.table}>
        <thead className={TABLE.thead}>
          <tr>
            {columns.map((width, i) => (
              <th key={i} className={TABLE.th}>
                <div className={clsx('h-3 rounded bg-gray-200', width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((line) => (
            <tr key={line} className="border-b border-gray-100 last:border-0">
              {columns.map((_, i) => (
                <td key={i} className={TABLE.td}>
                  <div
                    className={clsx(
                      'h-4 rounded bg-gray-100',
                      BAR_WIDTHS[(line + i) % BAR_WIDTHS.length],
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Placeholder rows for a shared list while it loads (036 A16), with the list's own column headers.
 *
 * `ResponsiveList` and `DataTable` used to collapse to a single "Loading…" line, so the page jumped
 * by a table's height the moment the rows arrived. This keeps the table's shape: the real headers,
 * and `rows` lines of bars beneath them. `cards` draws the phone layout of `ResponsiveList` instead.
 *
 * Announced once as "Loading…" through the `sr-only` status; the bars themselves are hidden.
 */
export function ListSkeleton({
  headers,
  rows = 5,
  actions = false,
  cards = false,
  className,
}: {
  headers: string[];
  rows?: number;
  actions?: boolean;
  /** The card-per-row layout `ResponsiveList` uses below `md`. */
  cards?: boolean;
  className?: string;
}) {
  const lines = Array.from({ length: rows }, (_, i) => i);
  if (cards) {
    return (
      <div className={clsx('space-y-3', className)} aria-hidden="true">
        {lines.map((line) => (
          <div
            key={line}
            className="animate-pulse space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            {headers.slice(0, 4).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div
                  className={clsx(
                    'h-3 rounded bg-gray-100',
                    BAR_WIDTHS[(line + i) % BAR_WIDTHS.length],
                  )}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={clsx(TABLE.wrap, className)} aria-hidden="true">
      <table className={TABLE.table}>
        <thead className={TABLE.thead}>
          <tr>
            {headers.map((header, i) => (
              <th key={i} scope="col" className={TABLE.th}>
                {header}
              </th>
            ))}
            {actions && <th className={TABLE.th} />}
          </tr>
        </thead>
        <tbody className="animate-pulse">
          {lines.map((line) => (
            <tr key={line} className="border-b border-gray-100 last:border-0">
              {headers.map((_, i) => (
                <td key={i} className={TABLE.td}>
                  <div
                    className={clsx(
                      'h-4 rounded bg-gray-100',
                      BAR_WIDTHS[(line + i) % BAR_WIDTHS.length],
                    )}
                  />
                </td>
              ))}
              {actions && (
                <td className={TABLE.td}>
                  <div className="ml-auto h-7 w-16 rounded bg-gray-100" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

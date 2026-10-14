import clsx from 'clsx';

import { TABLE } from '@/app/ui/table-classes';

// Loading animation
const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

export function CardSkeleton() {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded-xl bg-gray-100 p-2 shadow-sm`}
    >
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-gray-200" />
        <div className="ml-2 h-6 w-16 rounded-md bg-gray-200 text-sm font-medium" />
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-white px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-gray-200" />
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className={TABLE.row}>
      <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-100"></div>
          <div className="h-6 w-24 rounded bg-gray-100"></div>
        </div>
      </td>
      <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
        <div className="h-6 w-32 rounded bg-gray-100"></div>
      </td>
      <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </td>
      <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </td>
      <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
        <div className="flex justify-end gap-3">
          <div className="h-[38px] w-[38px] rounded bg-gray-100"></div>
          <div className="h-[38px] w-[38px] rounded bg-gray-100"></div>
        </div>
      </td>
    </tr>
  );
}

/** The loaded table's own card, header band and rows, with bars where the text will be. */
export function TableSkeleton() {
  return (
    <div className={clsx(TABLE.wrap, 'mt-6')} aria-hidden="true">
      <table className={TABLE.table}>
        <thead className={TABLE.thead}>
          <tr>
            {['w-20', 'w-28', 'w-14', 'w-14', 'w-10'].map((width, i) => (
              <th key={i} className={TABLE.th}>
                <div className={clsx('h-3 rounded bg-gray-200', width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </tbody>
      </table>
    </div>
  );
}

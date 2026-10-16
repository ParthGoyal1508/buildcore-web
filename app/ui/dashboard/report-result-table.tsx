'use client';

import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import type { ReportData } from '@/app/lib/api/dashboard';

/** Renders a report's tabular result, reusing the app-wide `ResponsiveList`. */
export default function ReportResultTable({ data }: { data: ReportData }) {
  const columns: Column<Record<string, unknown>>[] = data.columns.map(
    (col) => ({
      key: col.key,
      header: col.label,
      render: (row) => {
        const cell = row[col.key];
        return cell === null || cell === undefined || cell === ''
          ? '—'
          : String(cell);
      },
    }),
  );
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveList
        columns={columns}
        rows={data.rows}
        rowKey={(row) => JSON.stringify(row)}
        emptyMessage="This report returned no rows."
      />
      {/* The report's own account of an empty or partial result, which is usually more
          use than "no rows" — see `ReportData.note`. */}
      {data.note && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.note}
        </p>
      )}
    </div>
  );
}

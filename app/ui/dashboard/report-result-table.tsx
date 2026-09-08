'use client';

import ResponsiveList, {
  type Column,
} from '@/app/ui/settings/responsive-list';
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
    <ResponsiveList
      columns={columns}
      rows={data.rows}
      rowKey={(row) => JSON.stringify(row)}
      emptyMessage="This report returned no rows."
    />
  );
}

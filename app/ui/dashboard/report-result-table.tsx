'use client';

import { useMemo, useState } from 'react';

import type { ReportColumnType, ReportData } from '@/app/lib/api/dashboard';
import { dateLabel, quantity, rupees } from '@/app/lib/format';
import Pager from '@/app/ui/inventory/pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import type { TableSort } from '@/app/ui/table';

type Row = Record<string, unknown> & { __index: number };

const PAGE_SIZE = 50;
/** Columns whose values add up to something meaningful. */
const SUMMABLE: ReadonlySet<ReportColumnType> = new Set([
  'money',
  'number',
  'quantity',
]);

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

/** One cell as the reader should see it (036 E1). */
function formatCell(value: unknown, type: ReportColumnType | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return asNumber(value) === null ? String(value) : rupees(asNumber(value));
    case 'number':
    case 'quantity':
      return asNumber(value) === null ? String(value) : quantity(asNumber(value));
    case 'percent':
      return asNumber(value) === null ? String(value) : `${quantity(asNumber(value))}%`;
    case 'date':
      return typeof value === 'string' || value instanceof Date
        ? dateLabel(value)
        : String(value);
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : String(value);
    default:
      return String(value);
  }
}

/** What a column sorts by: the number for numeric columns, the raw ISO date, else the text. */
function sortValueOf(value: unknown, type: ReportColumnType | undefined) {
  if (value === null || value === undefined || value === '') return null;
  if (type && type !== 'text' && type !== 'date' && type !== 'boolean') {
    return asNumber(value);
  }
  return typeof value === 'boolean' ? (value ? 1 : 0) : String(value);
}

/**
 * A report's tabular result (036 E1).
 *
 * Every cell used to be `String(cell)` — a net pay read `48213.5`, a date `2026-10-01` — and rows
 * were keyed by `JSON.stringify(row)`, so two identical rows (two employees with the same figures on
 * a day) collided and one vanished. Now each column is formatted by its declared type (₹ with
 * grouping, DD-MM-YYYY, Yes/No), rows are keyed by position, the whole result sorts by any column,
 * long results page 50 at a time, and money and count columns are totalled beneath.
 */
export default function ReportResultTable({ data }: { data: ReportData }) {
  const [sort, setSort] = useState<TableSort>(null);
  const [page, setPage] = useState(1);

  const typeOf = useMemo(
    () => new Map(data.columns.map((c) => [c.key, c.type])),
    [data.columns],
  );

  const rows: Row[] = useMemo(() => {
    const indexed: Row[] = data.rows.map((row, i) => ({ ...row, __index: i }));
    if (!sort) return indexed;
    const type = typeOf.get(sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...indexed].sort((a, b) => {
      const x = sortValueOf(a[sort.key], type);
      const y = sortValueOf(b[sort.key], type);
      // Blanks last whichever way it sorts.
      if (x === null && y === null) return a.__index - b.__index;
      if (x === null) return 1;
      if (y === null) return -1;
      if (x < y) return -1 * dir;
      if (x > y) return 1 * dir;
      return a.__index - b.__index;
    });
  }, [data.rows, sort, typeOf]);

  const totals = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    for (const col of data.columns) {
      if (!col.type || !SUMMABLE.has(col.type)) continue;
      let sum = 0;
      let any = false;
      for (const row of data.rows) {
        const n = asNumber(row[col.key]);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      if (any) out.push({ label: col.label, value: formatCell(sum, col.type) });
    }
    return out;
  }, [data.columns, data.rows]);

  const columns: Column<Row>[] = data.columns.map((col) => ({
    key: col.key,
    header: col.label,
    className:
      col.type && col.type !== 'text' && col.type !== 'date' && col.type !== 'boolean'
        ? 'text-right tabular-nums'
        : undefined,
    render: (row) => formatCell(row[col.key], col.type),
  }));

  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, lastPage);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveList
        columns={columns}
        rows={visible}
        rowKey={(row) => String(row.__index)}
        // Sorted here over every row, then paged — a header that sorted only the visible page
        // would put the largest figure of page 2 below the smallest of page 1 (036 A13).
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        emptyMessage="This report returned no rows."
      />
      {rows.length > PAGE_SIZE && (
        <Pager
          total={rows.length}
          page={current}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          noun="row"
        />
      )}
      {totals.length > 0 && (
        <dl
          aria-label="Totals"
          className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-gray-50 px-3 py-2 text-sm"
        >
          {totals.map((t) => (
            <div key={t.label} className="flex gap-2">
              <dt className="text-gray-600">Total {t.label.toLowerCase()}</dt>
              <dd className="font-medium tabular-nums text-gray-900">{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
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

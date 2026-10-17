'use client';

import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { isValidElement, useMemo, useState } from 'react';

import { TABLE } from '@/app/ui/table-classes';

/**
 * The one table look, and click-to-sort, for every table in the app (2026-10-15).
 *
 * The client: "Table component is not consistent. Can we use consistent component. Also can we
 * use client side sorting on table data." There were two list components (`DataTable` for HR,
 * `ResponsiveList` for everything else) and some forty hand-written tables, each with its own
 * header case, padding, border and hover. They now all draw from these tokens, so a change to the
 * look is made here once.
 *
 * Sorting is the reader's, in the browser, over the rows already loaded: a click on a header sorts
 * ascending, a second descending, a third returns the order the screen chose. Nothing is sorted
 * until somebody asks, because many lists come in an order that means something — newest first,
 * the BOQ's own sequence.
 */
export { TABLE } from '@/app/ui/table-classes';

export type SortDirection = 'asc' | 'desc';
export type SortValue = string | number | boolean | Date | null | undefined;

export interface SortableColumn<T> {
  key: string;
  render: (row: T) => React.ReactNode;
  /** What the column sorts by, when what it shows is not it — a date shown as "1 Nov 2025". */
  sortValue?: (row: T) => SortValue;
  /** `false` for a column with nothing to order by: actions, a checkbox. */
  sortable?: boolean;
}

/** The text a cell shows, read out of the element tree it renders. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean')
    return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return '';
}

const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/**
 * A comparable value from what a cell shows: an amount or a count as a number — `₹21,37,00,000`,
 * `4/4`, `12.5%` — a date as its time, anything else as text. Blank and "—" are no value, and
 * sort last either way.
 */
function fromText(text: string): number | string | null {
  const t = text.trim();
  if (!t || t === '—' || t === '-') return null;
  const figure = /^[₹Rs.\s]*[-−]?[\d,]+(\.\d+)?\s*%?$/.exec(t);
  if (figure) return Number(t.replace(/[^\d.\-−]/g, '').replace('−', '-'));
  // DD-MM-YYYY (and DD-MM-YYYY HH:mm), the app’s one date format since 036 A18 — read as a date
  // rather than compared as text, which would order it by day of month.
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(t);
  if (ddmmyyyy) {
    const [, d, m, y, hh = '0', mm = '0'] = ddmmyyyy;
    return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  }
  const fraction = /^(\d+)\s*\/\s*(\d+)/.exec(t);
  if (fraction) return Number(fraction[1]) / Math.max(1, Number(fraction[2]));
  if (/^\d{4}-\d{2}-\d{2}/.test(t) || (MONTH.test(t) && /\d{4}/.test(t))) {
    const time = Date.parse(t);
    if (!Number.isNaN(time)) return time;
  }
  return t.toLowerCase();
}

function valueOf<T>(column: SortableColumn<T>, row: T): number | string | null {
  if (column.sortValue) {
    const v = column.sortValue(row);
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'boolean') return v ? 1 : 0;
    return typeof v === 'string' ? fromText(v) : v;
  }
  // The field of the same name, when the row has one: the raw date or amount beats its display.
  const field = (row as Record<string, unknown>)[column.key];
  if (typeof field === 'number') return field;
  if (typeof field === 'boolean') return field ? 1 : 0;
  if (typeof field === 'string' && field !== '') return fromText(field);
  return fromText(textOf(column.render(row)));
}

const collator = new Intl.Collator('en-IN', {
  numeric: true,
  sensitivity: 'base',
});

function compare(a: number | string | null, b: number | string | null) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** The rows in the order the reader asked for, and the header state that asks. */
export function useSortedRows<T>(rows: T[], columns: SortableColumn<T>[]) {
  const [sort, setSort] = useState<{ key: string; dir: SortDirection } | null>(
    null,
  );

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column) return rows;
    const keyed = rows.map((row) => ({ row, value: valueOf(column, row) }));
    keyed.sort((x, y) => {
      // No value sorts last in both directions: a blank is never the "highest".
      if (x.value === null) return y.value === null ? 0 : 1;
      if (y.value === null) return -1;
      const order = compare(x.value, y.value);
      return sort.dir === 'asc' ? order : -order;
    });
    return keyed.map((k) => k.row);
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((current) =>
      current?.key !== key
        ? { key, dir: 'asc' }
        : current.dir === 'asc'
          ? { key, dir: 'desc' }
          : null,
    );

  return { sorted, sort, toggle };
}

/**
 * A header cell that sorts its column. A button inside the `<th>`, so it is reached by Tab and
 * announced, and `aria-sort` tells a screen reader which way the column runs.
 */
export function SortHeader({
  label,
  columnKey,
  sort,
  onSort,
  sortable = true,
  numeric = false,
  className,
}: {
  label: React.ReactNode;
  columnKey: string;
  sort: { key: string; dir: SortDirection } | null;
  onSort: (key: string) => void;
  sortable?: boolean;
  numeric?: boolean;
  className?: string;
}) {
  const active = sort?.key === columnKey ? sort.dir : null;
  const Icon =
    active === 'asc'
      ? ChevronUpIcon
      : active === 'desc'
        ? ChevronDownIcon
        : ChevronUpDownIcon;
  return (
    <th
      scope="col"
      aria-sort={
        active === 'asc'
          ? 'ascending'
          : active === 'desc'
            ? 'descending'
            : undefined
      }
      className={clsx(TABLE.th, numeric && 'text-right', className)}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={clsx(
            'group relative -mx-1 rounded px-1 text-left transition-colors hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500',
            active && 'text-brand-700',
          )}
        >
          {label}
          <Icon
            aria-hidden="true"
            className={clsx(
              // In the cell's padding beside the label, not in the column's width: ten sortable
              // headers each widened by an arrow pushed a laptop-width list into scrolling.
              'absolute bottom-0.5 h-3.5 w-3.5 transition-opacity',
              numeric ? 'right-full' : 'left-full',
              active
                ? 'opacity-100'
                : 'opacity-30 group-hover:opacity-70 group-focus-visible:opacity-70',
            )}
          />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

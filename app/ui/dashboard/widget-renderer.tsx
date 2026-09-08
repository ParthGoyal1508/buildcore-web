'use client';

import ResponsiveList, {
  type Column,
} from '@/app/ui/settings/responsive-list';
import type { WidgetResult } from '@/app/lib/api/dashboard';

/**
 * The single switch that renders any widget from its `displayType` (spec FR-001,
 * FR-002). Nothing here knows an individual widget's id — a new widget renders with
 * zero code change, which is the whole point of the registry (spec SC-002).
 */
export default function WidgetRenderer({ widget }: { widget: WidgetResult }) {
  if (widget.unavailable) {
    return (
      <ComingSoonCard title={widget.title} module={widget.unavailable.module} />
    );
  }
  switch (widget.displayType) {
    case 'kpi':
      return <KpiCard title={widget.title} value={widget.value} />;
    case 'stat':
      return <StatCard title={widget.title} value={widget.value} />;
    case 'table':
      return <WidgetTable title={widget.title} value={widget.value} />;
    case 'list':
      return <WidgetList title={widget.title} value={widget.value} />;
    default:
      return (
        <UnsupportedWidgetCard
          title={widget.title}
          displayType={widget.displayType}
        />
      );
  }
}

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-4 shadow-sm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A single headline figure. Handles a plain number/string and the Group Dashboard's
 * company-card object (headcount + not-yet-computable sub-metrics). */
export function KpiCard({ title, value }: { title: string; value: unknown }) {
  let display = '—';
  let subtitle: string | null = null;
  if (typeof value === 'number' || typeof value === 'string') {
    display = String(value);
  } else if (isRecord(value) && 'headcount' in value) {
    display = String(value.headcount);
    const pending = Array.isArray(value.unavailableMetrics)
      ? value.unavailableMetrics.length
      : 0;
    if (pending > 0) subtitle = `${pending} more metrics coming soon`;
  }
  return (
    <div className={cardClass}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{display}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

/** A "present / total" style pair. */
export function StatCard({ title, value }: { title: string; value: unknown }) {
  let display = '—';
  if (isRecord(value) && 'present' in value && 'total' in value) {
    display = `${value.present} / ${value.total}`;
  } else if (typeof value === 'number' || typeof value === 'string') {
    display = String(value);
  }
  return (
    <div className={cardClass}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{display}</p>
    </div>
  );
}

interface TableValue {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

function isTableValue(value: unknown): value is TableValue {
  return (
    isRecord(value) &&
    Array.isArray(value.columns) &&
    Array.isArray(value.rows)
  );
}

/** A widget table, reusing the Settings `ResponsiveList` (one list pattern app-wide). */
export function WidgetTable({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  if (!isTableValue(value)) {
    return <UnsupportedWidgetCard title={title} displayType="table" />;
  }
  const columns: Column<Record<string, unknown>>[] = value.columns.map(
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
    <div className={cardClass}>
      <p className="mb-3 text-sm font-medium text-gray-700">{title}</p>
      <ResponsiveList
        columns={columns}
        rows={value.rows}
        rowKey={(row) => JSON.stringify(row)}
        emptyMessage="No rows."
      />
    </div>
  );
}

/** A simple bulleted list widget. */
export function WidgetList({ title, value }: { title: string; value: unknown }) {
  const items = Array.isArray(value) ? value : [];
  return (
    <div className={cardClass}>
      <p className="mb-2 text-sm font-medium text-gray-700">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to show.</p>
      ) : (
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {items.map((item, i) => (
            <li key={i}>
              {isRecord(item) ? JSON.stringify(item) : String(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The explicit "module not built yet" state (spec FR-003, FR-017). */
export function ComingSoonCard({
  title,
  module,
}: {
  title: string;
  module: string;
}) {
  return (
    <div className={`${cardClass} border-dashed`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-sm font-medium text-gray-400">Coming soon</p>
      <p className="mt-1 text-xs text-gray-400">
        Waiting on the {module} module.
      </p>
    </div>
  );
}

/** A displayType this build does not recognise — rendered, never crashed. */
export function UnsupportedWidgetCard({
  title,
  displayType,
}: {
  title: string;
  displayType: string;
}) {
  return (
    <div className={`${cardClass} border-dashed`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-xs text-gray-400">
        Unsupported widget type “{displayType}”.
      </p>
    </div>
  );
}

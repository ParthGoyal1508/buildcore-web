'use client';

import Link from 'next/link';

import { dateLabel, rupees } from '@/app/lib/format';

/** DD-MM-YYYY, like every other date (036 A18). Was "23 Sep" in this card alone. */
function shortDate(iso: string): string {
  return dateLabel(iso.slice(0, 10));
}
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import type { WidgetResult } from '@/app/lib/api/dashboard';
import { widgetIcon } from '@/app/ui/dashboard/widget-metrics';

/**
 * The single switch that renders any widget from its `displayType` (spec FR-001,
 * FR-002). Nothing here knows an individual widget's id — a new widget renders with
 * zero code change, which is the whole point of the registry (spec SC-002).
 */
export default function WidgetRenderer({
  widget,
  href,
}: {
  widget: WidgetResult;
  /**
   * The module screen this card leads to (2026-10-15). Supplied by the page from
   * `widget-links.ts` rather than looked up here, which keeps this switch free of widget
   * ids. Omitted, the card renders exactly as before — unlinked.
   */
  href?: string;
}) {
  if (widget.unavailable) {
    return (
      <ComingSoonCard
        title={widget.title}
        module={widget.unavailable.module}
        note={widget.unavailable.note}
      />
    );
  }
  switch (widget.displayType) {
    case 'kpi':
      return (
        <KpiCard
          title={widget.title}
          value={widget.value}
          unit={widget.valueUnit}
          note={widget.note}
          href={href}
        />
      );
    case 'stat':
      return <StatCard title={widget.title} value={widget.value} href={href} />;
    case 'table':
      return (
        <WidgetTable
          title={widget.title}
          value={widget.value}
          note={widget.note}
          href={href}
          icon={widgetIcon(widget.id)}
        />
      );
    case 'list':
      return (
        <WidgetList
          title={widget.title}
          value={widget.value}
          note={widget.note}
          href={href}
          icon={widgetIcon(widget.id)}
        />
      );
    default:
      return (
        <UnsupportedWidgetCard
          title={widget.title}
          displayType={widget.displayType}
        />
      );
  }
}

// The Group Dashboard's card since 2026-10-15, so the three dashboards match.
const cardClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm';

/** The focus ring every link on the dashboard carries — keyboard users must see where they are. */
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';

/**
 * A headline card that is itself the link (2026-10-15).
 *
 * The whole card rather than a "view" link inside it: the card is the target a person
 * reaches for, and a small link in a corner is a target they miss. Without an `href` it is
 * the plain card it always was.
 */
function CardShell({
  href,
  label,
  children,
}: {
  href?: string;
  /** Read by assistive technology as the link's name, so it says where it goes. */
  label: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={cardClass}>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={label}
      className={`group block ${cardClass} transition hover:border-brand-300 hover:shadow ${focusRing}`}
    >
      {children}
    </Link>
  );
}

/** A card heading that links to the module when there is one, with a "View all" cue. */
function CardHeading({
  title,
  href,
  className,
  icon: Icon,
}: {
  title: string;
  href?: string;
  className: string;
  /** The card's icon, in the accent tile the Group Dashboard's metrics use (2026-10-15). */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const mark = Icon && (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
  if (!href) {
    return (
      <p className={`flex items-center gap-2 ${className}`}>
        {mark}
        {title}
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <p className={`flex items-center gap-2 ${className}`}>
        {mark}
        <Link href={href} className={`rounded hover:underline ${focusRing}`}>
          {title}
        </Link>
      </p>
      <Link
        href={href}
        className={`shrink-0 rounded text-xs font-medium text-brand-700 hover:text-brand-900 hover:underline ${focusRing}`}
        aria-label={`View all — ${title}`}
      >
        View all →
      </Link>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A single headline figure. Handles a plain number/string and the Group Dashboard's
 * company-card object's headcount. */
export function KpiCard({
  title,
  value,
  unit,
  note,
  href,
}: {
  title: string;
  value: unknown;
  /** The module screen the card opens. */
  href?: string;
  /** Declared by the widget itself — see `valueUnit` on the wire type. */
  unit?: 'currency';
  /**
   * A caveat from the widget, when its figure is true but incomplete.
   *
   * Shown, not swallowed: the site fuel cards use it to say how many of the month's
   * entries carry no site and are therefore not in the number above. A card that
   * quietly understates a site's diesel is the thing this prevents.
   */
  note?: string;
}) {
  let display = '—';
  if (typeof value === 'number' || typeof value === 'string') {
    // A rupee figure is unreadable raw: the Contract Value card shipped showing
    // `371100000`, which is ₹37.11 crore written so that nobody can tell it from
    // ₹3.7 crore at a glance.
    display =
      unit === 'currency' && typeof value === 'number'
        ? rupees(value)
        : String(value);
  } else if (isRecord(value) && 'headcount' in value) {
    // The Group Dashboard renders its company cards itself since 2026-10-15
    // (`app/ui/dashboard/group-cards.tsx`); kept so a card object landing here still
    // shows its headline rather than a dash.
    display = String(value.headcount);
  }
  return (
    <CardShell href={href} label={`${title}: ${display}`}>
      <p className="text-sm text-gray-500 group-hover:text-brand-700">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{display}</p>
      {note && <p className="mt-2 text-xs text-amber-800">{note}</p>}
    </CardShell>
  );
}

/** A "present / total" style pair. */
export function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: unknown;
  href?: string;
}) {
  let display = '—';
  if (isRecord(value) && 'present' in value && 'total' in value) {
    display = `${value.present} / ${value.total}`;
  } else if (typeof value === 'number' || typeof value === 'string') {
    display = String(value);
  }
  return (
    <CardShell href={href} label={`${title}: ${display}`}>
      <p className="text-sm text-gray-500 group-hover:text-brand-700">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{display}</p>
    </CardShell>
  );
}

interface TableValue {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

function isTableValue(value: unknown): value is TableValue {
  return (
    isRecord(value) && Array.isArray(value.columns) && Array.isArray(value.rows)
  );
}

/** A widget table, reusing the Settings `ResponsiveList` (one list pattern app-wide). */
export function WidgetTable({
  title,
  value,
  note,
  href,
  icon,
}: {
  title: string;
  value: unknown;
  /** See the same prop on `KpiCard`. */
  note?: string;
  /** The module screen behind the table — linked from the heading. */
  href?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
        if (cell === null || cell === undefined || cell === '') return '—';
        // A bare ISO date reads as "23 Sep 2026" and stays on one line: in a half-width card
        // "2026-09-23" broke at its hyphens into two lines a row (2026-10-15).
        if (typeof cell === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cell)) {
          return (
            <span className="whitespace-nowrap" title={dateLabel(cell)}>
              {shortDate(cell)}
            </span>
          );
        }
        return String(cell);
      },
    }),
  );
  return (
    <div className={cardClass}>
      <div className="mb-3">
        <CardHeading
          title={title}
          href={href}
          className="text-sm font-semibold text-gray-900"
          icon={icon}
        />
      </div>
      <ResponsiveList
        columns={columns}
        rows={value.rows}
        rowKey={(row) => JSON.stringify(row)}
        emptyMessage="No rows."
      />
      {note && <p className="mt-2 text-xs text-amber-800">{note}</p>}
    </div>
  );
}

/** A simple bulleted list widget. */
/** The colour a list row carries, by the severity the source declared. */
const SEVERITY_CLASS: Record<string, string> = {
  overdue: 'text-red-700',
  warning: 'text-amber-700',
  info: 'text-gray-700',
};

/**
 * A list widget's rows.
 *
 * Items are `{ label, detail?, severity?, href? }`. A plain string still renders, for a
 * widget that only has words to show.
 *
 * **`JSON.stringify` used to be the fallback for an object item**, so the first list
 * widget to emit anything structured would have printed raw JSON onto the dashboard.
 * Nothing had, which is the only reason nobody saw it; Alerts & Reminders emits objects.
 */
export function WidgetList({
  title,
  value,
  note,
  href,
  icon,
}: {
  title: string;
  value: unknown;
  /** The screen listing every item, linked from the heading. */
  href?: string;
  /** "Showing 6 of 9 …" from the API when the card holds fewer than there are. */
  note?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const items = Array.isArray(value) ? value : [];
  return (
    <div className={`${cardClass} flex flex-col`}>
      <div className="mb-2">
        <CardHeading
          title={title}
          href={href}
          className="text-sm font-semibold text-gray-900"
          icon={icon}
        />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to show.</p>
      ) : (
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {items.map((item, i) => {
            if (!isRecord(item)) {
              return (
                <li key={i} className="py-1.5 text-gray-700">
                  {String(item)}
                </li>
              );
            }
            const label = String(item.label ?? '');
            const detail = item.detail ? String(item.detail) : null;
            const tone =
              SEVERITY_CLASS[String(item.severity ?? '')] ?? 'text-gray-700';
            const body = (
              <>
                <span className={tone}>{label}</span>
                {detail && (
                  <span className="ml-2 text-xs text-gray-500">{detail}</span>
                )}
              </>
            );
            return (
              <li key={i} className="py-1.5">
                {/* An in-app path goes through `Link` (client navigation, prefetch);
                    anything else stays a plain anchor. */}
                {typeof item.href === 'string' && item.href.startsWith('/') ? (
                  <Link
                    className={`rounded hover:underline ${focusRing}`}
                    href={item.href}
                  >
                    {body}
                  </Link>
                ) : typeof item.href === 'string' ? (
                  <a
                    className={`rounded hover:underline ${focusRing}`}
                    href={item.href}
                  >
                    {body}
                  </a>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* The footer the approvals card has (2026-10-15): what the card holds, and the way to
          the rest. The total is read from the API's note ("Showing 5 of 10 — …"). */}
      {note && (
        <p className="mt-auto border-t border-gray-100 pt-2 text-xs text-gray-500">
          {note}.{' '}
          {href && (
            <Link
              href={href}
              className={`rounded font-medium text-brand-700 hover:underline ${focusRing}`}
            >
              See all
              {/ of (\d+)/.exec(note)?.[1]
                ? ` ${/ of (\d+)/.exec(note)?.[1]}`
                : ''}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

/** The explicit "module not built yet" state (spec FR-003, FR-017). */
export function ComingSoonCard({
  title,
  module,
  note,
}: {
  title: string;
  module: string;
  /**
   * The card's own explanation, when the stock sentence is not true.
   *
   * The Statutory Calendar read "waiting on the challans module" long after Challans
   * shipped, which sent anybody investigating to a module that was already there.
   */
  note?: string;
}) {
  return (
    <div className={`${cardClass} border-dashed`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-sm font-medium text-gray-400">Coming soon</p>
      <p className="mt-1 text-xs text-gray-400">
        {note ?? `Waiting on the ${module} module.`}
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

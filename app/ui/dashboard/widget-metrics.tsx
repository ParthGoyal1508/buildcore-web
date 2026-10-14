'use client';

import {
  BanknotesIcon,
  BellAlertIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  FireIcon,
  TruckIcon,
  UserMinusIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import type { WidgetResult } from '@/app/lib/api/dashboard';
import { rupees } from '@/app/lib/format';
import { widgetHref } from '@/app/ui/dashboard/widget-links';
import {
  MetricTile,
  compactRupees,
  type Metric,
  type Tone,
} from '@/app/ui/dashboard/metric-tile';

type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/**
 * How each dashboard card reads as a tile (2026-10-15): its icon, a caption under the figure,
 * and when it deserves a colour. Keyed by the widget's id, as `widget-links.ts` is — the API
 * sends the figure, this says how to show it.
 */
const LOOK: Record<
  string,
  { icon: Icon; hint?: string; tone?: (value: unknown) => Tone }
> = {
  'total-employees': { icon: UsersIcon, hint: 'active employees' },
  'present-today': {
    icon: CheckCircleIcon,
    hint: 'checked in today',
    tone: (v) => (typeof v === 'number' && v > 0 ? 'ok' : 'default'),
  },
  'absent-today': {
    icon: UserMinusIcon,
    hint: 'not checked in',
    tone: (v) => (typeof v === 'number' && v > 0 ? 'warning' : 'default'),
  },
  'on-leave': { icon: CalendarDaysIcon, hint: 'approved leave today' },
  'pending-approvals': {
    icon: ClipboardDocumentCheckIcon,
    hint: 'waiting for a decision',
    tone: (v) => (typeof v === 'number' && v > 0 ? 'warning' : 'ok'),
  },
  'active-projects': { icon: BriefcaseIcon, hint: 'ongoing' },
  'total-machinery': { icon: TruckIcon, hint: 'in the register' },
  'contract-value': { icon: BanknotesIcon, hint: 'order book, ongoing' },
  'employees-on-muster': {
    icon: ClipboardDocumentListIcon,
    hint: 'marked on a muster',
  },
  'workers-today': { icon: UsersIcon, hint: 'on site today' },
  'machinery-deployed': { icon: TruckIcon, hint: 'deployed here' },
  'machinery-at-site': { icon: TruckIcon, hint: 'at this site' },
  'fuel-consumed': { icon: FireIcon, hint: 'this month' },
  'fuel-consumption': { icon: FireIcon, hint: 'this month' },
  'material-stock-value': { icon: CubeIcon, hint: 'stock on hand' },
  'material-stock': { icon: CubeIcon, hint: 'stock on hand' },
  // Cards that stay cards — tables and lists — carry the icon in their heading.
  'today-attendance': { icon: ClipboardDocumentListIcon },
  'site-today-attendance': { icon: ClipboardDocumentListIcon },
  'recent-leaves': { icon: CalendarDaysIcon },
  'alerts-reminders': { icon: BellAlertIcon },
};

/** The icon for a widget, for the cards that are not tiles (tables, lists). */
export function widgetIcon(id: string): Icon {
  return LOOK[id]?.icon ?? WrenchScrewdriverIcon;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/**
 * A KPI or stat card as a tile, or `null` for anything a tile cannot carry — a table, a list,
 * or a card whose module is not available (those keep their own card).
 */
export function widgetMetric(widget: WidgetResult): Metric | null {
  if (widget.unavailable) return null;
  if (widget.displayType !== 'kpi' && widget.displayType !== 'stat') {
    return null;
  }
  const { value } = widget;
  let display: string;
  let title: string | undefined;
  if (typeof value === 'number' && widget.valueUnit === 'currency') {
    display = compactRupees(value);
    title = rupees(value);
  } else if (typeof value === 'number' || typeof value === 'string') {
    display = String(value);
  } else if (isRecord(value) && 'present' in value && 'total' in value) {
    display = `${value.present} / ${value.total}`;
  } else {
    return null;
  }
  const look = LOOK[widget.id];
  return {
    key: widget.id,
    label: widget.title,
    icon: look?.icon ?? WrenchScrewdriverIcon,
    value: display,
    title,
    // A note from the API ("month in progress") says more than the stock caption.
    hint: widget.note ?? look?.hint,
    tone: look?.tone?.(value) ?? 'default',
    href: widgetHref(widget.id),
  };
}

/**
 * The navy summary a dashboard opens with — the Group Total's look — holding the page's
 * headline figures as tiles. `children` sits in the header's right-hand side (a selector, a
 * date).
 */
export function SummaryBanner({
  title,
  subtitle,
  mark,
  metrics,
  children,
}: {
  title: string;
  subtitle?: string;
  /** A logo or icon before the title. */
  mark?: React.ReactNode;
  metrics: Metric[];
  children?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 p-4 text-white shadow-sm sm:p-5"
      aria-label={title}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {mark}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-brand-100">{subtitle}</p>}
          </div>
        </div>
        {children}
      </header>
      {metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricTile key={metric.key} metric={metric} inverted />
          ))}
        </dl>
      ) : (
        <p className="text-sm text-brand-100">No figures to show yet.</p>
      )}
    </section>
  );
}

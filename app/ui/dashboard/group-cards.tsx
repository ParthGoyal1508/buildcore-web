'use client';

import {
  BanknotesIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import type {
  GroupCompanyCard,
  GroupTotal,
  StatutoryCalendar,
  StatutoryDueItem,
} from '@/app/lib/api/dashboard';
import type { SelectableCompany } from '@/app/lib/api/company-selection';
import { dateLabel, rupees, shortPeriodLabel } from '@/app/lib/format';
import { CompanyMark } from '@/app/ui/company-logo';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import {
  MetricTile,
  compactRupees,
  type Metric,
} from '@/app/ui/dashboard/metric-tile';

/**
 * The Group Dashboard's own cards (2026-10-15): one per company, a Group Total, and the
 * Statutory Calendar.
 *
 * Dedicated components rather than more branches in `WidgetRenderer`, which renders one
 * headline per card by design. A company card is six labelled figures read side by side
 * across companies, and squeezing that into a KPI tile is what left these cards saying
 * "4 more metrics coming soon".
 *
 * Every metric beyond headcount is optional on the wire — the API omits what the reader's
 * role does not open — so each tile renders only when its figure arrived, and the grid
 * simply has fewer tiles for a narrower role.
 */

/** "2026-09" → "Sep 2026": the month a payroll figure belongs to, short enough for a label. */
function shortPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return shortPeriodLabel(`${year}-${String(month).padStart(2, '0')}`);
}

/** "Sep 2026", or "Sep – Oct 2026" when the companies' latest runs differ. */
function periodsLabel(periods: string[]): string | null {
  if (periods.length === 0) return null;
  if (periods.length === 1) return shortPeriod(periods[0]);
  const first = shortPeriod(periods[0]);
  const last = shortPeriod(periods[periods.length - 1]);
  // "Sep – Oct 2026" within one year; both years in full across a year end.
  return periods[0].slice(0, 4) === periods[periods.length - 1].slice(0, 4)
    ? `${first.split(' ')[0]} – ${last}`
    : `${first} – ${last}`;
}

/** The tiles a card shows, from whichever metrics arrived. */
function metricsFor(card: GroupCompanyCard | GroupTotal): Metric[] {
  const metrics: Metric[] = [
    {
      key: 'headcount',
      label: 'Headcount',
      icon: UsersIcon,
      value: card.headcount.toLocaleString('en-IN'),
      hint: 'active employees',
    },
  ];

  if (card.activeProjects) {
    metrics.push(
      {
        key: 'projects',
        label: 'Active projects',
        icon: BuildingOffice2Icon,
        value: card.activeProjects.count.toLocaleString('en-IN'),
        hint: 'ongoing',
      },
      {
        key: 'order-book',
        label: 'Order book',
        icon: BriefcaseIcon,
        value: compactRupees(card.activeProjects.contractValue),
        title: rupees(card.activeProjects.contractValue),
        hint: 'contract value, ongoing',
      },
    );
  }

  if (card.payroll) {
    const period =
      'periods' in card.payroll
        ? periodsLabel(card.payroll.periods)
        : card.payroll.period && shortPeriod(card.payroll.period);
    const gross = card.payroll.gross;
    const ran = period !== null && gross !== null;
    metrics.push({
      key: 'payroll',
      label: ran ? `Payroll cost (${period})` : 'Payroll cost',
      icon: BanknotesIcon,
      value: ran ? compactRupees(gross) : 'No run yet',
      title: ran ? rupees(gross) : undefined,
      hint: ran
        ? 'periods' in card.payroll && card.payroll.periods.length > 1
          ? 'gross, latest run each'
          : 'gross, latest processed run'
        : 'no processed payroll',
    });
  }

  if (card.pfEsic) {
    const period =
      'periods' in card.pfEsic
        ? periodsLabel(card.pfEsic.periods)
        : card.pfEsic.period && shortPeriod(card.pfEsic.period);
    const { total, pf, esic } = card.pfEsic;
    const ran = period !== null && total !== null;
    metrics.push({
      key: 'pf-esic',
      // "PF + ESIC (Sep 2026)", never "pending": nothing records whether it was filed.
      label: ran ? `PF + ESIC (${period})` : 'PF + ESIC',
      icon: ShieldCheckIcon,
      value: ran ? compactRupees(total) : 'No run yet',
      title: ran ? rupees(total) : undefined,
      hint: ran
        ? `PF ${compactRupees(pf ?? 0)} · ESIC ${compactRupees(esic ?? 0)}`
        : 'no processed payroll',
    });
  }

  if (card.loans) {
    metrics.push({
      key: 'loans',
      label: 'Loans outstanding',
      icon: CreditCardIcon,
      value: compactRupees(card.loans.outstanding),
      title: rupees(card.loans.outstanding),
      hint:
        card.loans.count === 0
          ? 'no active loans'
          : `${card.loans.count} active loan${card.loans.count === 1 ? '' : 's'}`,
    });
  }

  if (card.documents) {
    const { missing, required } = card.documents;
    metrics.push({
      key: 'documents',
      label: 'Company documents',
      icon: missing > 0 ? ExclamationTriangleIcon : CheckCircleIcon,
      value: missing > 0 ? `${missing} missing` : 'All on file',
      hint: `${required - missing} of ${required} required on file`,
      tone: missing > 0 ? 'warning' : 'ok',
      wide: true,
    });
  }

  return metrics;
}

/** One company: its mark, its name, and its figures in a two-column grid. */
export function CompanyCard({
  card,
  logo,
}: {
  card: GroupCompanyCard;
  /** From the selectable-companies list; absent means initials. */
  logo?: Pick<SelectableCompany, 'hasLogo' | 'logoVersion'>;
}) {
  return (
    <section
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label={card.name}
    >
      <header className="mb-3 flex items-center gap-3">
        <span className="grid h-11 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5">
          <CompanyMark
            company={{
              id: card.companyId,
              name: card.name,
              hasLogo: logo?.hasLogo ?? false,
              logoVersion: logo?.logoVersion ?? null,
            }}
          />
        </span>
        <div className="min-w-0">
          <h2
            className="truncate text-sm font-semibold text-gray-900"
            title={card.name}
          >
            {card.name}
          </h2>
          <span className="mt-0.5 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand-600">
            {card.shortCode}
          </span>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-2">
        {metricsFor(card).map((metric) => (
          <MetricTile key={metric.key} metric={metric} />
        ))}
      </dl>
    </section>
  );
}

/** The group as a whole, set apart in the brand navy so it reads as the summary. */
export function GroupTotalCard({ total }: { total: GroupTotal }) {
  const metrics = metricsFor(total);
  return (
    <section
      className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 p-4 text-white shadow-sm sm:p-5"
      aria-label="Group Total"
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">Group Total</h2>
        <p className="text-xs text-brand-100">
          Across {total.companies}{' '}
          {total.companies === 1 ? 'company' : 'companies'}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricTile key={metric.key} metric={metric} inverted />
        ))}
      </dl>
    </section>
  );
}

/** "Due in 12 days" / "Due today" / "Overdue by 3 days" — the date's distance, nothing more. */
function dueStatus(days: number): { label: string; className: string } {
  if (days < 0) {
    const n = Math.abs(days);
    return {
      label: `Overdue by ${n} day${n === 1 ? '' : 's'}`,
      className: 'bg-red-50 text-red-700 ring-red-200',
    };
  }
  if (days === 0) {
    return {
      label: 'Due today',
      className: 'bg-amber-50 text-amber-800 ring-amber-200',
    };
  }
  return {
    label: `Due in ${days} day${days === 1 ? '' : 's'}`,
    className:
      days <= 7
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-gray-50 text-gray-700 ring-gray-200',
  };
}

function StatusPill({ days }: { days: number }) {
  const status = dueStatus(days);
  return (
    <span
      className={clsx(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        status.className,
      )}
    >
      {status.label}
    </span>
  );
}

const SCHEME_LABEL: Record<string, string> = {
  PF: 'PF',
  ESIC: 'ESIC',
  TDS: 'TDS (salary)',
};

function amountLabel(item: StatutoryDueItem): React.ReactNode {
  return item.amount === null ? (
    <span className="text-gray-400">Run not processed</span>
  ) : (
    rupees(item.amount)
  );
}

const itemKey = (item: StatutoryDueItem) =>
  `${item.companyId}|${item.scheme}|${item.period}`;

const CALENDAR_COLUMNS: Column<StatutoryDueItem>[] = [
  {
    key: 'dueDate',
    header: 'Due date',
    render: (item) => (
      <span className="whitespace-nowrap font-medium text-gray-900">
        {dateLabel(item.dueDate)}
      </span>
    ),
    sortValue: (item) => item.dueDate,
  },
  {
    key: 'company',
    header: 'Company',
    render: (item) => <span title={item.companyName}>{item.shortCode}</span>,
    sortValue: (item) => item.shortCode,
  },
  {
    key: 'scheme',
    header: 'Scheme',
    render: (item) => SCHEME_LABEL[item.scheme] ?? item.scheme,
    sortValue: (item) => item.scheme,
  },
  {
    key: 'period',
    header: 'For month',
    render: (item) => shortPeriod(item.period),
    sortValue: (item) => item.period,
  },
  {
    key: 'amount',
    header: 'Amount',
    numeric: true,
    render: amountLabel,
    sortValue: (item) => item.amount ?? -1,
  },
  {
    key: 'status',
    header: 'Status',
    render: (item) => <StatusPill days={item.daysRemaining} />,
    sortValue: (item) => item.daysRemaining,
  },
];

/**
 * Upcoming statutory payments across the group.
 *
 * The subtitle says plainly that filing is not tracked: the dates are the statute's and
 * the amounts the payroll run's, and a status of "Overdue" means the date has passed —
 * not that anybody failed to pay.
 */
export function StatutoryCalendarCard({
  calendar,
}: {
  calendar: StatutoryCalendar;
}) {
  const { items, schemes, horizonDays, note } = calendar;
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="statutory-calendar-heading"
    >
      <header className="mb-3 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-700">
          <CalendarDaysIcon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2
            id="statutory-calendar-heading"
            className="text-base font-semibold text-gray-900"
          >
            Statutory Calendar
          </h2>
          <p className="text-xs text-gray-500">
            Next {horizonDays} days ·{' '}
            {note ??
              'Filing is not tracked here — dates are statutory, amounts are from processed payroll runs.'}
          </p>
        </div>
      </header>

      {schemes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          Statutory dates are shown to people with payroll or challan access.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          No statutory payments fall due in the next {horizonDays} days.
        </p>
      ) : (
        <>
          {/* Phones: one stacked row per payment — six columns do not fit 360px. */}
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 sm:hidden">
            {items.map((item) => (
              <li key={itemKey(item)} className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {SCHEME_LABEL[item.scheme] ?? item.scheme} ·{' '}
                    <span title={item.companyName}>{item.shortCode}</span>
                  </span>
                  <StatusPill days={item.daysRemaining} />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    {dateLabel(item.dueDate)} · for {shortPeriod(item.period)}
                  </span>
                  <span className="tabular-nums text-gray-800">
                    {amountLabel(item)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <DataTable
              columns={CALENDAR_COLUMNS}
              rows={items}
              rowKey={itemKey}
              caption="Statutory due dates"
            />
          </div>
        </>
      )}
    </section>
  );
}

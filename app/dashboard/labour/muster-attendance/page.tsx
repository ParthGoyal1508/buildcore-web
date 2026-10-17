'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  correctLabourPunch,
  downloadLabourAttendanceSheet,
  getLabourDayRules,
  getMusterDaily,
  getMusterMonthly,
  getMyLabourSites,
  getPunchCorrections,
  setLabourDayRules,
  type LabourDayRules,
  type MusterDay,
  type MusterDailyRow,
  type MusterFilter,
  type MusterMonthRow,
  type PunchFact,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  LABOUR_DAY_FLAG_LABELS,
  LABOUR_DAY_STATUS_LABELS,
  ROUTES,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { urlEnum, urlString, useUrlState } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import { LoadingText } from '@/app/ui/spinner';
import { useToast } from '@/app/ui/toast';
import {
  businessDate,
  clockTime,
  dateLabel,
  dateTimeLabel,
  todayIso,
} from '@/app/lib/format';
import { ListSkeleton } from '@/app/ui/skeletons';

/** The badge colour for each day status: a missing punch reads as a warning, not as absent. */
const STATUS_TONE: Record<string, string> = {
  full_day: 'ok',
  half_day: 'info',
  short: 'on_hold',
  on_site: 'in_transit',
  unresolved: 'warning',
  absent: 'inactive',
};

const FILTERS: { value: MusterFilter | ''; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'missing_punch_out', label: 'Missing punch out' },
  { value: 'flagged', label: 'Any flag' },
  { value: 'present', label: 'Present (full or half day)' },
  { value: 'on_site', label: 'On site now' },
  { value: 'short', label: 'Short' },
  { value: 'absent', label: 'Absent' },
];

const pad = (n: number) => String(n).padStart(2, '0');
/** Times are India time throughout (036 O5): the API reads a correction's `HH:mm` in the company's
 * zone, and the form used to prefill it in the browser's — a laptop on another zone saved the
 * wrong time. `clockTime` is IST, and so is `todayIso`. */
const timeOf = (iso: string) => clockTime(iso);
const messageOf = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.status < 500 ? e.message : fallback;

/** A worker row matches the search box by name or labour code (036 O7). */
function matches(row: { fullName: string; labourCode: string }, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return (
    row.fullName.toLowerCase().includes(term) ||
    row.labourCode.toLowerCase().includes(term)
  );
}

const FILTER_VALUES = FILTERS.map((f) => f.value);

/**
 * Muster attendance from punch times (034). The daily view lists every labour with their punch in
 * and out, the hours between, the status those hours make and any flag — a missing punch out above
 * all. The monthly view shows each day's hours with flagged days highlighted. A supervisor or the
 * HR office with "Correct labour punches" adds or fixes a punch with a reason, and every edit is
 * kept. Nobody marks a status by hand: it comes from the hours and the company's day rules.
 */
function MusterAttendanceBody() {
  // 036 O7 / A14: the view, site, date, month, filter and search live in the URL, so Back from a
  // worker keeps them and a supervisor can send the exact view as a link.
  const [state, setState] = useUrlState(
    {
      view: urlEnum(['daily', 'monthly'] as const, 'daily'),
      site: urlString(),
      date: urlString(todayIso()),
      month: urlString(todayIso().slice(0, 7)),
      show: urlEnum(FILTER_VALUES, ''),
      q: urlString(),
    },
    { debounce: ['q'] },
  );
  const view = state.view;
  const siteId = state.site;
  const date = state.date;
  const month = state.month;
  const filter = state.show;
  const setView = (v: 'daily' | 'monthly') => setState({ view: v });
  const setFilter = (f: MusterFilter | '') => setState({ show: f });
  const [correcting, setCorrecting] = useState<{
    row: { workerId: string; fullName: string; labourCode: string };
    day: MusterDay;
  } | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const permissions = user.data?.permissions ?? [];
  const canCorrect = permissions.includes('LABOUR_PUNCH_CORRECT');
  const canSetRules = permissions.includes('LABOUR_APPROVE');

  const sites = useQuery({ queryKey: ['labour', 'my-sites'], queryFn: getMyLabourSites });
  const rules = useQuery({
    queryKey: ['labour', 'day-rules'],
    queryFn: () => getLabourDayRules(),
    retry: false,
  });

  const download = useMutation({
    mutationFn: () => {
      // 036 O7: the month on screen — the viewed date's month in the daily view. It used to take
      // the monthly view's hidden month, so the Excel was for a month nobody was looking at.
      const [year, m] = (view === 'daily' ? date.slice(0, 7) : month)
        .split('-')
        .map(Number);
      return downloadLabourAttendanceSheet({ ...(siteId ? { siteId } : {}), year, month: m });
    },
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) => setError(messageOf(e, 'Could not create the sheet. Try again.')),
  });

  const multiSite = (sites.data?.length ?? 0) > 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Muster Attendance"
          description="Punch in and out times for every labour, the hours worked and what they count as."
        />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => setShowRules(true)}>
            Day rules
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={download.isPending || sites.data?.length === 0}
            onClick={() => {
              setError(null);
              download.mutate();
            }}
          >
            {download.isPending ? 'Excel…' : 'Monthly Excel'}
          </SecondaryButton>
        </div>
      </div>

      {rules.data && (
        <p className="text-xs text-gray-500">
          Full day {rules.data.fullDayHours} h or more · half day {rules.data.halfDayHours} h or
          more · short below that (not paid) · overtime after {rules.data.standardHours} h. A day
          with a missing punch is not counted until it is corrected.
        </p>
      )}

      <FormError message={error} />

      <div role="tablist" aria-label="View" className="flex gap-2">
        {(['daily', 'monthly'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={clsx(
              'h-9 rounded-full border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
              view === v
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-300 bg-white text-gray-700',
            )}
          >
            {v === 'daily' ? 'Daily' : 'Monthly'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="ma-site"
          label="Site"
          value={siteId}
          onChange={(e) => setState({ site: e.target.value })}
          disabled={sites.isPending}
        >
          <option value="">{multiSite ? 'All my sites' : sites.data?.[0]?.name ?? 'Site'}</option>
          {multiSite &&
            sites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        {view === 'daily' ? (
          <>
            <TextField
              id="ma-date"
              label="Date"
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setState({ date: e.target.value || todayIso() })}
            />
            <SelectField
              id="ma-filter"
              label="Show"
              value={filter}
              onChange={(e) => setFilter(e.target.value as MusterFilter | '')}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </SelectField>
          </>
        ) : (
          <TextField
            id="ma-month"
            label="Month"
            type="month"
            value={month}
            max={todayIso().slice(0, 7)}
            onChange={(e) =>
              setState({ month: e.target.value || todayIso().slice(0, 7) })
            }
          />
        )}
        <TextField
          id="ma-search"
          label="Search"
          type="search"
          placeholder="Name or labour code"
          value={state.q}
          onChange={(e) => setState({ q: e.target.value })}
        />
      </div>

      {sites.data?.length === 0 ? (
        <p className="rounded-md bg-gray-100 px-3 py-3 text-sm text-gray-700">
          No sites are assigned to you yet. Ask the HR office to assign your site.
        </p>
      ) : view === 'daily' ? (
        <DailyView
          siteId={siteId}
          date={date}
          filter={filter}
          search={state.q}
          showSite={multiSite && !siteId}
          canCorrect={canCorrect}
          onFilter={setFilter}
          onCorrect={(row) => setCorrecting({ row, day: row })}
        />
      ) : (
        <MonthlyView
          siteId={siteId}
          month={month}
          search={state.q}
          showSite={multiSite && !siteId}
          canCorrect={canCorrect}
          onCorrect={(row, day) => setCorrecting({ row, day })}
        />
      )}

      <p className="text-xs text-gray-500">
        Muster rolls entered before face punches are still under{' '}
        <Link href={ROUTES.labourMusters} className="text-brand-700 underline">
          Musters
        </Link>
        .
      </p>

      {correcting && (
        <CorrectionModal
          worker={correcting.row}
          day={correcting.day}
          canCorrect={canCorrect}
          onClose={() => setCorrecting(null)}
        />
      )}
      {showRules && (
        <DayRulesModal
          // Remounted when the rules arrive, so the fields start from the company's values — not
          // from the 8/4/8 defaults a modal opened early used to show and then save (036 O6).
          key={rules.data ? 'loaded' : 'loading'}
          rules={rules.data ?? null}
          loading={rules.isPending}
          loadError={rules.isError ? rules.error : null}
          onRetry={rules.refetch}
          canEdit={canSetRules}
          onClose={() => setShowRules(false)}
        />
      )}
    </div>
  );
}

export default function MusterAttendancePage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      }
    >
      <MusterAttendanceBody />
    </Suspense>
  );
}

function DailyView({
  siteId,
  date,
  filter,
  search,
  showSite,
  canCorrect,
  onFilter,
  onCorrect,
}: {
  siteId: string;
  date: string;
  filter: MusterFilter | '';
  search: string;
  showSite: boolean;
  canCorrect: boolean;
  onFilter: (f: MusterFilter | '') => void;
  onCorrect: (row: MusterDailyRow) => void;
}) {
  const daily = useQuery({
    queryKey: ['labour', 'muster-daily', siteId, date, filter],
    queryFn: () =>
      getMusterDaily({
        date,
        ...(siteId ? { siteId } : {}),
        ...(filter ? { filter } : {}),
      }),
  });
  const s = daily.data?.summary;

  const columns: Column<MusterDailyRow>[] = [
    {
      key: 'worker',
      header: 'Worker',
      render: (r) => (
        <span>
          {r.fullName}
          <span className="block text-xs text-gray-500">{r.labourCode}</span>
        </span>
      ),
    },
    {
      key: 'gang',
      header: 'Contractor / Gang',
      render: (r) => [r.contractorName, r.gangName].filter(Boolean).join(' / ') || '—',
    },
    ...(showSite
      ? [{ key: 'site', header: 'Site', render: (r: MusterDailyRow) => r.siteName }]
      : []),
    { key: 'in', header: 'Punch in', render: (r) => <PunchCell punch={r.punchIn} /> },
    { key: 'out', header: 'Punch out', render: (r) => <PunchCell punch={r.punchOut} /> },
    {
      key: 'hours',
      header: 'Total hours',
      render: (r) =>
        r.hours === null ? (
          '—'
        ) : (
          <span className="whitespace-nowrap">
            {r.hours} h
            {r.overtimeHours > 0 && (
              <span className="block text-xs text-gray-500">+{r.overtimeHours} h OT</span>
            )}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.manual ? (
          <span className="text-sm text-gray-600">
            {LABOUR_DAY_STATUS_LABELS[r.status]} (muster)
          </span>
        ) : (
          <StatusBadge status={STATUS_TONE[r.status]} label={LABOUR_DAY_STATUS_LABELS[r.status]} />
        ),
    },
    {
      key: 'flag',
      header: 'Flag',
      render: (r) =>
        r.flag ? (
          <StatusBadge
            tone="warning"
            label={LABOUR_DAY_FLAG_LABELS[r.flag]}
            icon={ExclamationTriangleIcon}
          />
        ) : (
          <span className="text-sm text-gray-500">—</span>
        ),
    },
  ];

  const chips: { label: string; value: number | string; filter?: MusterFilter; warn?: boolean }[] =
    s
      ? [
          { label: 'Workers', value: s.workers },
          { label: 'Present', value: s.present, filter: 'present' },
          { label: 'On site now', value: s.onSite, filter: 'on_site' },
          { label: 'Short', value: s.short, filter: 'short' },
          { label: 'Absent', value: s.absent, filter: 'absent' },
          {
            label: 'Missing punch out',
            value: s.missingPunchOut,
            filter: 'missing_punch_out',
            warn: s.missingPunchOut > 0,
          },
          {
            label: 'Other flags',
            value: s.otherFlags,
            filter: 'flagged',
            warn: s.otherFlags > 0,
          },
          { label: 'Overtime', value: `${s.overtimeHours} h` },
        ]
      : [];

  return (
    <div className="space-y-4">
      {s && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {chips.map((c) => {
            const body = (
              <>
                <dt className="text-xs text-gray-500">{c.label}</dt>
                <dd
                  className={clsx(
                    'mt-0.5 text-lg font-semibold',
                    c.warn ? 'text-amber-800' : 'text-gray-900',
                  )}
                >
                  {c.value}
                </dd>
              </>
            );
            const box = clsx(
              'rounded-md border p-2.5 text-left',
              c.warn ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white',
              c.filter && filter === c.filter && 'ring-2 ring-brand-500',
            );
            return c.filter ? (
              <button
                key={c.label}
                type="button"
                className={clsx(box, 'hover:border-brand-300')}
                onClick={() => onFilter(filter === c.filter ? '' : c.filter!)}
              >
                {body}
              </button>
            ) : (
              <div key={c.label} className={box}>
                {body}
              </div>
            );
          })}
        </dl>
      )}
      <ResponsiveList
        columns={columns}
        rows={(daily.data?.items ?? []).filter((r) => matches(r, search))}
        rowKey={(r) => `${r.workerId}|${r.siteId}`}
        isLoading={daily.isPending}
        error={daily.error}
        onRetry={daily.refetch}
        emptyMessage={
          filter || search.trim()
            ? 'Nobody matches this filter.'
            : 'No labour at this site yet.'
        }
        actions={(r) =>
          r.manual ? null : (
            <RowAction intent="read" onClick={() => onCorrect(r)}>
              {canCorrect ? 'Correct' : 'History'}
            </RowAction>
          )
        }
      />
    </div>
  );
}

function PunchCell({ punch }: { punch: PunchFact | null }) {
  if (!punch) return <span className="text-gray-500">—</span>;
  return (
    <span className="whitespace-nowrap" title={punch.recordedBy ? `Recorded by ${punch.recordedBy}` : undefined}>
      {timeOf(punch.at)}
      {(punch.corrected || punch.outsideFence) && (
        <span className="block text-xs text-gray-500">
          {[
            punch.source === 'correction' ? 'added' : punch.corrected ? 'corrected' : null,
            punch.outsideFence ? 'outside fence' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </span>
  );
}

function MonthlyView({
  siteId,
  month,
  search,
  showSite,
  canCorrect,
  onCorrect,
}: {
  siteId: string;
  month: string;
  search: string;
  showSite: boolean;
  canCorrect: boolean;
  onCorrect: (row: MusterMonthRow, day: MusterDay) => void;
}) {
  const [year, m] = month.split('-').map(Number);
  const monthly = useQuery({
    queryKey: ['labour', 'muster-monthly', siteId, month],
    queryFn: () => getMusterMonthly({ year, month: m, ...(siteId ? { siteId } : {}) }),
    enabled: !!year && !!m,
  });

  if (monthly.isPending) {
    // The grid's shape while the month loads (036 A16).
    return (
      <>
        <p className="sr-only" role="status">
          Loading…
        </p>
        <ListSkeleton
          headers={['Worker', 'Days', 'Full', 'Half', 'Short', 'Payable', 'Hours']}
          rows={8}
        />
      </>
    );
  }
  if (monthly.isError) {
    return (
      <QueryError
        error={monthly.error}
        onRetry={monthly.refetch}
        fallback="Could not load the month."
      />
    );
  }
  const data = monthly.data;
  const items = data.items.filter((row) => matches(row, search));
  const days = Array.from({ length: data.daysInMonth }, (_, i) => i + 1);
  const dateOf = (d: number) => `${month}-${pad(d)}`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        {data.summary.workers} labour · {data.summary.payableDays} payable days ·{' '}
        {data.summary.overtimeHours} h overtime
        {data.summary.unresolved > 0 && (
          <StatusBadge
            tone="warning"
            label={`${data.summary.unresolved} unresolved day${data.summary.unresolved === 1 ? '' : 's'} — not counted until corrected`}
            icon={ExclamationTriangleIcon}
            className="ml-2 !whitespace-normal"
          />
        )}
      </p>
      <p className="text-xs text-gray-500">
        Each day shows the hours worked. Green full day, blue half day, orange short, amber a
        missing or wrong punch. Hover for the times; click a day to see or correct it.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse whitespace-nowrap text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium">
                Worker
              </th>
              {days.map((d) => (
                <th key={d} className="min-w-[2.5rem] px-0.5 py-2 text-center font-medium">
                  {d}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Full</th>
              <th className="px-2 py-2 text-right font-medium">Half</th>
              <th className="px-2 py-2 text-right font-medium">Short</th>
              <th className="px-2 py-2 text-right font-medium">Unres.</th>
              <th className="px-2 py-2 text-right font-medium">Payable</th>
              <th className="px-2 py-2 text-right font-medium">Hours</th>
              <th className="px-2 py-2 text-right font-medium">OT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={days.length + 8} className="px-3 py-6 text-center text-sm text-gray-500">
                  {search.trim()
                    ? 'Nobody matches this search.'
                    : 'No labour at this site this month.'}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={`${row.workerId}|${row.siteId}`} className="border-t border-gray-100">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5">
                  <span className="text-sm text-gray-900">{row.fullName}</span>
                  <span className="block text-gray-500">
                    {row.labourCode}
                    {showSite ? ` · ${row.siteName}` : ''}
                  </span>
                </td>
                {days.map((d) => {
                  const day = row.days[dateOf(d)];
                  return (
                    <td key={d} className="p-0.5 text-center">
                      {day ? (
                        <button
                          type="button"
                          disabled={day.manual}
                          onClick={() => onCorrect(row, day)}
                          title={dayTitle(day)}
                          aria-label={`${row.fullName}, ${dateOf(d)}: ${dayTitle(day)}${
                            canCorrect && !day.manual ? '. Open to correct.' : ''
                          }`}
                          className={clsx(
                            'h-8 w-full min-w-[2.25rem] rounded font-medium',
                            CELL_TONE[day.status],
                          )}
                        >
                          {day.manual
                            ? 'M'
                            : day.hours !== null
                            ? day.hours
                            : day.status === 'on_site'
                            ? 'in'
                            : '!'}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 text-right">{row.totals.fullDays}</td>
                <td className="px-2 text-right">{row.totals.halfDays}</td>
                <td className="px-2 text-right">{row.totals.shortDays}</td>
                <td
                  className={clsx(
                    'px-2 text-right',
                    row.totals.unresolved > 0 && 'font-semibold text-amber-800',
                  )}
                >
                  {row.totals.unresolved}
                </td>
                <td className="px-2 text-right font-medium">{row.totals.payableDays}</td>
                <td className="px-2 text-right">{row.totals.hours}</td>
                <td className="px-2 text-right">{row.totals.overtimeHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const CELL_TONE: Record<string, string> = {
  full_day: 'bg-green-100 text-green-900 hover:bg-green-200',
  half_day: 'bg-brand-100 text-brand-900 hover:bg-brand-200',
  short: 'bg-orange-100 text-orange-900 hover:bg-orange-200',
  on_site: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  unresolved: 'bg-amber-300 text-amber-950 ring-1 ring-amber-500 hover:bg-amber-400',
  absent: 'text-gray-500',
};

function dayTitle(day: MusterDay): string {
  if (day.manual) return `${LABOUR_DAY_STATUS_LABELS[day.status]}, marked on a muster`;
  const parts = [
    `In ${day.punchIn ? timeOf(day.punchIn.at) : '—'}`,
    `Out ${day.punchOut ? timeOf(day.punchOut.at) : '—'}`,
    day.hours !== null ? `${day.hours} h` : null,
    LABOUR_DAY_STATUS_LABELS[day.status],
    day.overtimeHours > 0 ? `+${day.overtimeHours} h OT` : null,
    day.flag ? LABOUR_DAY_FLAG_LABELS[day.flag] : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Add or fix a punch, with a reason (034). Both times are prefilled with what is recorded, and
 * only a changed one is sent, so the history shows exactly what was touched. The edit history of
 * the day is below the form, and is all a caller without the permission sees.
 */
function CorrectionModal({
  worker,
  day,
  canCorrect,
  onClose,
}: {
  worker: { workerId: string; fullName: string; labourCode: string };
  day: MusterDay;
  canCorrect: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const initialIn = day.punchIn ? timeOf(day.punchIn.at) : '';
  const initialOut = day.punchOut ? timeOf(day.punchOut.at) : '';
  // 036 O5: a punch out recorded on the day after is a night shift.
  const initialNextDay =
    !!day.punchOut && businessDate(day.punchOut.at) !== day.date;
  const [punchIn, setPunchIn] = useState(initialIn);
  const [punchOut, setPunchOut] = useState(initialOut);
  const [nextDay, setNextDay] = useState(initialNextDay);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ['labour', 'punch-corrections', worker.workerId, day.date],
    queryFn: () => getPunchCorrections(worker.workerId, day.date),
  });

  const changedIn = punchIn !== '' && punchIn !== initialIn;
  // Ticking "next day" moves the recorded out-time a day, so it is sent again with the flag even
  // when the time itself is unchanged.
  const changedOut =
    punchOut !== '' && (punchOut !== initialOut || nextDay !== initialNextDay);
  const outBeforeIn =
    !nextDay && punchIn !== '' && punchOut !== '' && punchOut <= punchIn;

  const save = useMutation({
    mutationFn: () =>
      correctLabourPunch({
        workerId: worker.workerId,
        date: day.date,
        ...(changedIn ? { punchIn } : {}),
        ...(changedOut
          ? { punchOut, ...(nextDay ? { punchOutNextDay: true } : {}) }
          : {}),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success('Correction saved.');
      void queryClient.invalidateQueries({ queryKey: ['labour'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e, 'Could not save the correction.')),
  });

  const editable = canCorrect && !day.manual;
  return (
    <Modal
      title={`${worker.fullName} · ${dateLabel(day.date)}`}
      onClose={onClose}
      isDirty={changedIn || changedOut || reason.trim() !== ''}
      pending={save.isPending}
      footer={
        editable ? (
          <>
            <SecondaryButton
              type="button"
              onClick={onClose}
              disabled={save.isPending}
            >
              Cancel
            </SecondaryButton>
            <Button
              type="button"
              disabled={
                (!changedIn && !changedOut) ||
                outBeforeIn ||
                reason.trim().length < 3
              }
              loading={save.isPending}
              onClick={() => {
                setError(null);
                save.mutate();
              }}
            >
              Save correction
            </Button>
          </>
        ) : (
          <SecondaryButton type="button" onClick={onClose}>
            Close
          </SecondaryButton>
        )
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {worker.labourCode} · {dayTitle(day)}
        </p>
        <FormError message={error} />
        {editable && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="corr-in"
                label="Punch in (IST)"
                type="time"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
              />
              <TextField
                id="corr-out"
                label="Punch out (IST)"
                type="time"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                error={
                  outBeforeIn
                    ? 'Must be after the punch in — or tick "next day" for a night shift.'
                    : undefined
                }
              />
            </div>
            <CheckboxField
              id="corr-next-day"
              label="Punch out next day"
              description="A night shift that ended after midnight. At most 16 hours after the punch in."
              checked={nextDay}
              onChange={(e) => setNextDay(e.target.checked)}
            />
            <div>
              <label htmlFor="corr-reason" className="mb-1 block text-sm font-medium text-gray-700">
                Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                id="corr-reason"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Phone had no signal at punch out; gate register shows 6:10 pm"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Kept in the edit history with the old and new time, your name and when.
              </p>
            </div>
          </>
        )}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Edit history</h3>
          {history.isPending ? (
            <p className="text-sm text-gray-500" role="status">
              <LoadingText />
            </p>
          ) : history.isError ? (
            <QueryError
              compact
              error={history.error}
              onRetry={history.refetch}
              fallback="Could not load the history."
            />
          ) : history.data.length === 0 ? (
            <p className="text-sm text-gray-500">No corrections to this day.</p>
          ) : (
            <ol className="space-y-2 border-l border-gray-200 pl-4 text-sm">
              {history.data.map((h) => (
                <li key={h.id}>
                  <p className="text-gray-900">
                    Punch {h.type}: {h.oldPunchedAt ? timeOf(h.oldPunchedAt) : 'missing'} →{' '}
                    {timeOf(h.newPunchedAt)}
                  </p>
                  <p className="text-gray-700">“{h.reason}”</p>
                  <p className="text-xs text-gray-500">
                    {h.correctedBy ?? 'Someone'} ·{' '}
                    {dateTimeLabel(h.correctedAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** The company's thresholds; the HR office (`LABOUR_APPROVE`) changes them. */
function DayRulesModal({
  rules,
  loading,
  loadError,
  onRetry,
  canEdit,
  onClose,
}: {
  rules: LabourDayRules | null;
  /** 036 O6: Save stays off until the company's own rules are in the fields. */
  loading: boolean;
  loadError: unknown;
  onRetry: () => unknown;
  canEdit: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [full, setFull] = useState(String(rules?.fullDayHours ?? 8));
  const [half, setHalf] = useState(String(rules?.halfDayHours ?? 4));
  const [standard, setStandard] = useState(String(rules?.standardHours ?? 8));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const values = { fullDayHours: Number(full), halfDayHours: Number(half), standardHours: Number(standard) };
  const invalid =
    [values.fullDayHours, values.halfDayHours, values.standardHours].some(
      (v) => !Number.isFinite(v) || v <= 0 || v > 24,
    )
      ? 'Each value must be more than 0 and at most 24 hours.'
      : values.halfDayHours >= values.fullDayHours
      ? 'Half day hours must be fewer than full day hours.'
      : null;

  const ready = !!rules && !loading && !loadError;
  const dirty =
    !!rules &&
    (values.fullDayHours !== rules.fullDayHours ||
      values.halfDayHours !== rules.halfDayHours ||
      values.standardHours !== rules.standardHours);

  const save = useMutation({
    mutationFn: () => setLabourDayRules(values),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['labour'] });
      setDone(
        `Saved. ${r.recounted} unpaid day${r.recounted === 1 ? ' was' : 's were'} re-counted; days already on a payment sheet were left as paid.`,
      );
    },
    onError: (e) => setError(messageOf(e, 'Could not save the day rules.')),
  });

  return (
    <Modal
      title="Day rules"
      onClose={onClose}
      isDirty={dirty && !done}
      pending={save.isPending}
      footer={
        canEdit && !loadError && !done ? (
          <>
            <SecondaryButton
              type="button"
              onClick={onClose}
              disabled={save.isPending}
            >
              Cancel
            </SecondaryButton>
            <Button
              type="button"
              disabled={!ready || !!invalid}
              loading={save.isPending}
              onClick={() => {
                setError(null);
                save.mutate();
              }}
            >
              Save
            </Button>
          </>
        ) : (
          <SecondaryButton type="button" onClick={onClose}>
            Close
          </SecondaryButton>
        )
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          How a labour day counts from the hours between punch in and punch out. Overtime is paid at
          the daily rate ÷ standard shift hours × the company&rsquo;s overtime multiplier.
        </p>
        {loadError ? (
          // A cross-company caller with no company chosen gets a 400 here; anything else is a
          // failed load worth retrying.
          loadError instanceof ApiError && loadError.status === 400 ? (
            <FormError message="Pick a company first to see its day rules." />
          ) : (
            <QueryError
              error={loadError}
              onRetry={onRetry}
              fallback="Could not load the day rules."
            />
          )
        ) : loading ? (
          <p className="text-sm text-gray-500" role="status">
            <LoadingText />
          </p>
        ) : (
          <>
            <FormError message={error ?? (canEdit ? invalid : null)} />
            {done && (
              <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
                {done}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                id="rule-full"
                label="Full day from (hours)"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={full}
                disabled={!canEdit || !!done}
                onChange={(e) => setFull(e.target.value)}
              />
              <TextField
                id="rule-half"
                label="Half day from (hours)"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={half}
                disabled={!canEdit || !!done}
                onChange={(e) => setHalf(e.target.value)}
              />
              <TextField
                id="rule-standard"
                label="Overtime after (hours)"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={standard}
                disabled={!canEdit || !!done}
                onChange={(e) => setStandard(e.target.value)}
              />
            </div>
            {!canEdit && (
              <p className="text-xs text-gray-500">Only the HR office can change these.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

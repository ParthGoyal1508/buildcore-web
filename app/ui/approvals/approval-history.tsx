'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { Suspense } from 'react';

import {
  exportApprovalHistory,
  getApprovalHistoryList,
  type ApprovalHistoryEntry,
  type ApprovalHistoryStatus,
  type ApprovalHistoryStep,
  type ApprovalStateName,
} from '@/app/lib/api/approvals';
import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { searchActivityUsers, triggerDownload } from '@/app/lib/api/dashboard';
import { getCurrentUser } from '@/app/lib/api/users';
import { approvalActionTypeLabel } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import DateRangeFilter, {
  RANGE_PRESETS,
  rangeOf,
} from '@/app/ui/dashboard/date-range-filter';
import QueryError from '@/app/ui/query-error';
import {
  inlineSelectClass,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { toast } from '@/app/ui/toast';

/**
 * Every approval the caller may read — decided, in progress or withdrawn — grouped by
 * module, each with its whole chain (2026-10-15).
 *
 * ## What the client asked for
 *
 * "Show past approvals along with pending ones … show the approval hierarchy and who
 * approved what, and group approvals by module." The queue above this answers only
 * "what must I decide now", and empties the moment you have decided — so on a quiet day
 * the Approvals screen was a blank page. This is the rest of the picture.
 *
 * ## Who sees what
 *
 * The API lists an item when the caller could open that item's own history: they hold
 * the permission its module declared for it (PAYROLL for a payroll run,
 * PROJECT_FINANCIALS for a bill), or they took part — raised it, were delegated it, or
 * decided at any level. "Only ones I took part in" narrows to the second.
 *
 * ## The chain, not a log
 *
 * Each item shows every level of its chain in order, with who decided it, when, and the
 * remark they left — and the level it is waiting on, highlighted. A flat list of
 * decisions would lose the levels nobody has reached yet, and the fact that a rejection
 * at level 1 means the Director never saw it.
 */

const STATUS_TABS: { value: ApprovalHistoryStatus; label: string }[] = [
  { value: 'decided', label: 'Decided' },
  { value: 'open', label: 'In progress' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'all', label: 'All' },
];
const STATUS_VALUES = STATUS_TABS.map((t) => t.value) as [
  ApprovalHistoryStatus,
  ...ApprovalHistoryStatus[],
];
const SCOPES = ['visible', 'mine'] as const;

const PAGE_SIZE = 20;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

/**
 * 036 D1–D2: filters in the URL (status, scope, module, date, search, who raised it), a CSV export
 * of what is filtered, and one list in the order the server sorts it — newest latest action first.
 *
 * The list used to be regrouped by module *within each page*, so page 1 could show a September
 * decision under "Billing" above an October one under "Payroll" — newer below older, depending on
 * which modules happened to share the page. The module is on each card now and the chips still
 * filter, so the order on screen is the order of events.
 */
export default function ApprovalHistory() {
  return (
    // Filters in the URL read `useSearchParams` (036 D1).
    <Suspense>
      <ApprovalHistoryInner />
    </Suspense>
  );
}

function ApprovalHistoryInner() {
  const [filters, setFilters, query] = useUrlState(
    {
      status: urlEnum(STATUS_VALUES, 'decided'),
      scope: urlEnum(SCOPES, 'visible'),
      module: urlString(),
      q: urlString(),
      by: urlString(),
      range: urlEnum(RANGE_PRESETS, 'all'),
      month: urlString(),
      from: urlString(),
      to: urlString(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  const range = rangeOf({
    preset: query.range,
    month: query.month,
    from: query.from,
    to: query.to,
  });
  const filtersFor = {
    status: query.status,
    scope: query.scope,
    module: query.module || undefined,
    q: query.q.trim() || undefined,
    requestedBy: query.by || undefined,
    from: range.from,
    to: range.to,
  };

  // A Super Admin with no company selected has no single company's approvals to list — the API
  // answers empty — so the screen says why rather than "No approvals yet" (036 D2).
  const { data: me } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const selectedCompanyId = useSelectedCompanyId();
  const noCompany =
    (me?.permissions.includes('CROSS_COMPANY_ACCESS') ?? false) &&
    !selectedCompanyId;

  const history = useQuery({
    queryKey: ['approvalHistoryList', filtersFor, query.page],
    queryFn: () =>
      getApprovalHistoryList({
        ...filtersFor,
        page: query.page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !range.error && !noCompany,
    // Paging keeps the previous page on screen until the next arrives, so the list does
    // not collapse to "Loading…" and jump the reader back to the top.
    placeholderData: keepPreviousData,
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await exportApprovalHistory(filtersFor);
      triggerDownload(blob, 'approval-history.csv');
    },
    onError: (e: unknown) =>
      toast.error(errorMessage(e, 'The history could not be exported.')),
  });

  const data = history.data;
  const modules = data?.modules ?? [];
  const allCount = modules.reduce((sum, m) => sum + m.count, 0);
  const items = data?.items ?? [];
  const requester = items.find((i) => i.requestedById === query.by);

  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const filtered =
    Boolean(filtersFor.q) ||
    Boolean(filtersFor.requestedBy) ||
    Boolean(filtersFor.from || filtersFor.to) ||
    Boolean(filtersFor.module);

  if (noCompany) {
    return (
      <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        Approvals belong to a company. Choose one in the company switcher at the
        top to see its approval history.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div
          role="tablist"
          aria-label="Approval status"
          className="inline-flex rounded-md border border-gray-300 bg-white p-0.5"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.value}
              onClick={() => setFilters({ status: tab.value, module: '' })}
              className={clsx(
                'min-h-9 rounded px-3 text-sm font-medium',
                focusRing,
                filters.status === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Show</span>
          <select
            className={inlineSelectClass}
            value={filters.scope}
            onChange={(e) =>
              setFilters({
                scope: e.target.value as (typeof SCOPES)[number],
                module: '',
              })
            }
          >
            <option value="visible">Everything I can see</option>
            <option value="mine">Only ones I raised or decided</option>
          </select>
        </label>

        <SecondaryButton
          type="button"
          className="ml-auto"
          loading={download.isPending}
          disabled={Boolean(range.error)}
          onClick={() => download.mutate()}
        >
          Export CSV
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <TextField
          id="approval-history-search"
          label="Search"
          type="search"
          placeholder="Subject, or who raised or decided it"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <div>
          <label
            htmlFor="approval-history-by"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Raised by
          </label>
          <AsyncSelect
            id="approval-history-by"
            value={filters.by}
            onChange={(id) => setFilters({ by: id })}
            emptyLabel="Anyone"
            placeholder="Anyone"
            selectedOption={
              filters.by && requester
                ? { id: filters.by, label: requester.requestedByName }
                : null
            }
            cacheKey={['activity-users']}
            search={(term, page) =>
              searchActivityUsers(term, page).then((r) => ({
                items: r.items.map((u) => ({ id: u.id, label: u.name })),
                total: r.total,
              }))
            }
          />
        </div>
        <DateRangeFilter
          idPrefix="approval-history"
          preset={filters.range}
          month={filters.month}
          from={filters.from}
          to={filters.to}
          error={range.error}
          onChange={(patch) =>
            setFilters({
              ...(patch.preset !== undefined ? { range: patch.preset } : {}),
              ...(patch.month !== undefined ? { month: patch.month } : {}),
              ...(patch.from !== undefined ? { from: patch.from } : {}),
              ...(patch.to !== undefined ? { to: patch.to } : {}),
            })
          }
        />
      </div>

      {modules.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by module"
        >
          <ModuleChip
            label="All modules"
            count={allCount}
            active={filters.module === ''}
            onClick={() => setFilters({ module: '' })}
          />
          {modules.map((m) => (
            <ModuleChip
              key={m.key}
              label={m.label}
              count={m.count}
              active={filters.module === m.key}
              onClick={() => setFilters({ module: m.key })}
            />
          ))}
        </div>
      )}

      {history.isPending && !range.error && (
        <ListSkeleton headers={['Approval']} rows={3} cards />
      )}
      {history.isError && (
        <QueryError error={history.error} onRetry={history.refetch} />
      )}
      {data && data.total === 0 && (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          {filtered
            ? 'No approvals match these filters.'
            : filters.scope === 'mine'
              ? 'Nothing here that you raised or decided.'
              : 'No approvals to show here yet.'}
        </p>
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            Newest first, by the latest action on each item — its decision once
            it is decided.
          </p>
          <ul
            className={clsx('space-y-3', history.isPlaceholderData && 'opacity-60')}
            aria-busy={history.isFetching || undefined}
          >
            {items.map((item) => (
              <li key={item.instanceId}>
                <HistoryCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFilters({ page: Math.max(1, query.page - 1) })}
            disabled={query.page === 1 || history.isFetching}
            className={clsx(
              'min-h-9 rounded-md border border-gray-300 px-3 text-sm disabled:opacity-40',
              focusRing,
            )}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {first}–{last} of {data.total}
          </span>
          <button
            type="button"
            onClick={() => setFilters({ page: query.page + 1 })}
            disabled={last >= data.total || history.isFetching}
            className={clsx(
              'min-h-9 rounded-md border border-gray-300 px-3 text-sm disabled:opacity-40',
              focusRing,
            )}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ModuleChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'min-h-8 rounded-full border px-3 text-xs font-medium',
        focusRing,
        active
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {label} <span className="text-gray-500">{count}</span>
    </button>
  );
}

const STATE_BADGE: Record<ApprovalStateName, { label: string; cls: string }> =
  {
    pending: { label: 'In progress', cls: 'bg-brand-50 text-brand-800' },
    returned: {
      label: 'Returned for correction',
      cls: 'bg-amber-50 text-amber-900',
    },
    approved: { label: 'Approved', cls: 'bg-green-50 text-green-800' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-800' },
    abandoned: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-700' },
  };

/** One item: what it is, who raised it, where it stands, and its chain. */
function HistoryCard({ item }: { item: ApprovalHistoryEntry }) {
  const badge = STATE_BADGE[item.state];
  const earlier = item.earlierDecisions;
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-gray-900">
            {item.href ? (
              <Link
                href={item.href}
                className={`rounded text-brand-700 hover:text-brand-900 hover:underline ${focusRing}`}
              >
                {item.subject}
              </Link>
            ) : (
              item.subject
            )}
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{item.moduleLabel}</span> ·{' '}
            {approvalActionTypeLabel(item.actionType)} · Raised by{' '}
            <span className="text-gray-700">{item.requestedByName}</span> ·{' '}
            {dateTimeLabel(item.requestedAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={clsx(
              'rounded px-2 py-0.5 text-xs font-medium',
              badge.cls,
            )}
          >
            {badge.label}
          </span>
          {(item.closedAt ?? item.lastActionAt) && (
            <span className="text-xs text-gray-500">
              {item.closedAt ? '' : 'Last action '}
              {dateTimeLabel(item.closedAt ?? item.lastActionAt)}
            </span>
          )}
        </div>
      </div>

      {item.state === 'pending' && item.awaitingLabel && (
        <p className="mt-2 text-xs text-brand-800">
          Waiting on {item.delegatedToName ?? item.awaitingLabel}
          {item.delegatedToName ? ` (reassigned, ${item.awaitingLabel})` : ''} —
          level {item.currentPosition} of {item.totalLevels}
        </p>
      )}
      {item.state === 'returned' && (
        <p className="mt-2 text-xs text-amber-900">
          Waiting on {item.requestedByName} to correct and resubmit.
        </p>
      )}

      <ol
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Approval chain"
      >
        {item.steps.map((step) => (
          <StepCard key={step.position} step={step} />
        ))}
      </ol>

      {earlier.length > 0 && (
        <details className="mt-3 text-xs">
          <summary
            className={`cursor-pointer rounded text-brand-700 hover:text-brand-900 ${focusRing}`}
          >
            Earlier rounds — returned {item.returnCount || earlier.length}×
          </summary>
          <ol className="mt-2 space-y-1.5 border-l border-gray-200 pl-3">
            {earlier.map((d, i) => (
              <li key={`${d.round}-${d.position}-${i}`} className="text-gray-700">
                <span className="text-gray-500">Round {d.round} · </span>
                <span className="font-medium text-gray-900">
                  {DECISION_VERB[d.action]}
                </span>{' '}
                by {d.actorName} at {d.levelLabel} · {dateTimeLabel(d.decidedAt)}
                {d.reason && (
                  <p className="mt-0.5 text-gray-600">“{d.reason}”</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

const DECISION_VERB: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  return: 'Returned',
};

const STEP_STYLE: Record<
  ApprovalHistoryStep['status'],
  { label: string; dot: string; box: string }
> = {
  approved: {
    label: 'Approved',
    dot: 'bg-green-600',
    box: 'border-green-200 bg-green-50/40',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-red-600',
    box: 'border-red-200 bg-red-50/40',
  },
  returned: {
    label: 'Returned for correction',
    dot: 'bg-amber-500',
    box: 'border-amber-200 bg-amber-50/40',
  },
  current: {
    label: 'Waiting here',
    dot: 'bg-brand-600 ring-4 ring-brand-100',
    box: 'border-brand-400 bg-brand-50 ring-1 ring-brand-300',
  },
  upcoming: {
    label: 'Not yet',
    dot: 'bg-gray-300',
    box: 'border-gray-200 bg-white',
  },
  not_reached: {
    label: 'Not reached',
    dot: 'bg-gray-200',
    box: 'border-dashed border-gray-200 bg-gray-50 text-gray-500',
  },
};

/** One level of the chain: its role, its outcome, who and when, and any remark. */
function StepCard({ step }: { step: ApprovalHistoryStep }) {
  const style = STEP_STYLE[step.status];
  return (
    <li
      className={clsx('rounded-md border p-2.5 text-xs', style.box)}
      aria-current={step.status === 'current' ? 'step' : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={clsx('inline-block h-2.5 w-2.5 rounded-full', style.dot)}
        />
        <span className="font-medium text-gray-900">
          {step.position}. {step.label}
        </span>
        {step.isFinalAuthority && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
            Final
          </span>
        )}
      </div>
      <p className="mt-1 text-gray-700">
        {style.label}
        {step.actorName && (
          <>
            {' '}
            by <span className="font-medium">{step.actorName}</span>
          </>
        )}
      </p>
      {step.decidedAt && (
        <p className="text-gray-500">{dateTimeLabel(step.decidedAt)}</p>
      )}
      {step.reason && <p className="mt-1 text-gray-600">“{step.reason}”</p>}
    </li>
  );
}

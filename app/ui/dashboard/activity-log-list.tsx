'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  exportActivityLog,
  getActivityLog,
  searchActivityUsers,
  triggerDownload,
  type ActivityLogEntry,
} from '@/app/lib/api/dashboard';
import {
  ACTIVITY_MODULES,
  ACTIVITY_MODULE_LABELS,
  ACTIVITY_TIME_RANGES,
  ACTIVITY_TIME_RANGE_LABELS,
  activityModuleLabel,
  enumLabel,
} from '@/app/lib/constants';
import AsyncSelect from '@/app/ui/async-select';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import {
  fieldClass,
  inlineSelectClass,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import { toast } from '@/app/ui/toast';
import { dateTimeLabel, todayIso } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';

/**
 * What each audited action is called, for the person reading the log.
 *
 * `AuditAction` is a SCREAMING_SNAKE enum and the column printed it verbatim, so the
 * log read `LOGIN_SUCCESS`, `ADMIN_PASSWORD_RESET` and — worst of the ten —
 * `REFRESH_REUSE_DETECTED`, which is a security event somebody is meant to act on and
 * which names itself in the vocabulary of the token implementation. `enumLabel` is no
 * help here: it only capitalises the first letter of each word, and these are already
 * upper case, so it returns "LOGIN SUCCESS".
 *
 * Local to this component on purpose — the activity log is the only screen that shows
 * an audit action. An unknown value still falls through to `enumLabel` rather than
 * rendering blank, so an action added to the enum appears in the log before anyone
 * remembers to name it here.
 */
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  READ: 'Viewed',
  LOGIN_SUCCESS: 'Signed in',
  LOGIN_FAILURE: 'Sign-in failed',
  ACCOUNT_LOCKED: 'Account locked',
  LOGOUT: 'Signed out',
  REFRESH_REUSE_DETECTED: 'Expired session token reused — refused',
  ADMIN_PASSWORD_RESET: 'Password reset by an administrator',
};

export const actionLabel = (action: string) =>
  ACTION_LABELS[action] ?? enumLabel(action);

/**
 * What happened, in words: the API's sentence where it has one ("Confirmed their password for
 * Personal Settings"), otherwise the action and what it was done to ("Updated PRPL-2401 —
 * Whitefield"). The record's id is never the reader's answer (2026-10-15).
 */
export const activityWhat = (e: ActivityLogEntry) =>
  e.description ?? actionLabel(e.action);
export const activityTarget = (e: ActivityLogEntry) =>
  e.targetLabel !== undefined ? e.targetLabel : e.target;

const RANGE_VALUES = ['', ...ACTIVITY_TIME_RANGES, 'custom'] as const;
type RangeValue = (typeof RANGE_VALUES)[number];

export default function ActivityLogList() {
  return (
    // Filters in the URL read `useSearchParams` (036 E3).
    <Suspense>
      <ActivityLogInner />
    </Suspense>
  );
}

/**
 * 036 E3: a custom date range besides the presets, a User filter and a search, all in the URL; the
 * previous page stays on screen while the next loads (it blanked to "Loading…" on every page turn);
 * and an export failure is a toast that goes away rather than a red line that stayed until reload.
 */
function ActivityLogInner() {
  const [filters, setFilters, query] = useUrlState(
    {
      module: urlString(),
      range: urlEnum(RANGE_VALUES, ''),
      from: urlString(),
      to: urlString(),
      user: urlString(),
      q: urlString(),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );

  const custom = query.range === 'custom';
  const rangeError =
    custom && query.from && query.to && query.from > query.to
      ? 'The From date must not be after the To date.'
      : null;
  const params = {
    module: query.module || undefined,
    timeRange: !custom && query.range ? query.range : undefined,
    from: custom ? query.from || undefined : undefined,
    to: custom ? query.to || undefined : undefined,
    userId: query.user || undefined,
    q: query.q.trim() || undefined,
  };

  const feed = useQuery({
    queryKey: ['activity-log', params, query.page],
    queryFn: () => getActivityLog({ ...params, page: query.page }),
    enabled: !rangeError,
    placeholderData: keepPreviousData,
  });

  const download = useMutation({
    mutationFn: async () => {
      const blob = await exportActivityLog(params);
      triggerDownload(blob, 'activity-log.csv');
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not export.')),
  });

  const columns: Column<ActivityLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'When',
      render: (e) => dateTimeLabel(e.timestamp),
    },
    { key: 'actor', header: 'User', render: (e) => e.actor },
    { key: 'action', header: 'Action', render: (e) => activityWhat(e) },
    {
      key: 'module',
      header: 'Module',
      render: (e) => activityModuleLabel(e.module),
    },
    {
      key: 'target',
      header: 'Target',
      render: (e) => activityTarget(e) ?? '—',
    },
  ];

  const filtered = Object.values(params).some(Boolean);
  const emptyMessage = filtered
    ? 'No activity matches these filters.'
    : 'No activity recorded yet.';
  // With a User filter every row is theirs, so the first names them for the picker's label.
  const actorName = query.user ? feed.data?.entries[0]?.actor : undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Module</span>
          <select
            className={inlineSelectClass}
            value={filters.module}
            onChange={(e) => setFilters({ module: e.target.value })}
          >
            <option value="">All modules</option>
            {ACTIVITY_MODULES.map((m) => (
              <option key={m} value={m}>
                {ACTIVITY_MODULE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-700">Time range</span>
          <select
            className={inlineSelectClass}
            value={filters.range}
            onChange={(e) => setFilters({ range: e.target.value as RangeValue })}
          >
            <option value="">All time</option>
            {ACTIVITY_TIME_RANGES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TIME_RANGE_LABELS[t]}
              </option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
        </label>

        {filters.range === 'custom' && (
          <>
            <label className="text-sm" htmlFor="activity-from">
              <span className="mb-1 block text-gray-700">From</span>
              <input
                id="activity-from"
                type="date"
                className={fieldClass}
                value={filters.from}
                max={filters.to || todayIso()}
                aria-invalid={rangeError ? true : undefined}
                onChange={(e) => setFilters({ from: e.target.value })}
              />
            </label>
            <label className="text-sm" htmlFor="activity-to">
              <span className="mb-1 block text-gray-700">To</span>
              <input
                id="activity-to"
                type="date"
                className={fieldClass}
                value={filters.to}
                min={filters.from || undefined}
                max={todayIso()}
                aria-invalid={rangeError ? true : undefined}
                onChange={(e) => setFilters({ to: e.target.value })}
              />
            </label>
          </>
        )}

        <div className="min-w-[14rem]">
          <label
            htmlFor="activity-user"
            className="mb-1 block text-sm text-gray-700"
          >
            User
          </label>
          <AsyncSelect
            id="activity-user"
            value={filters.user}
            onChange={(id) => setFilters({ user: id })}
            emptyLabel="Anyone"
            placeholder="Anyone"
            selectedOption={
              filters.user && actorName
                ? { id: filters.user, label: actorName }
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

        <label className="text-sm" htmlFor="activity-search">
          <span className="mb-1 block text-gray-700">Search</span>
          <input
            id="activity-search"
            type="search"
            className={fieldClass}
            placeholder="Name, email or record id"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
          />
        </label>

        <SecondaryButton
          onClick={() => download.mutate()}
          loading={download.isPending}
          disabled={Boolean(rangeError)}
          className="ml-auto"
        >
          Export CSV
        </SecondaryButton>
      </div>

      {rangeError && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {rangeError}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={feed.data?.entries ?? []}
        rowKey={(e) => e.id}
        emptyMessage={emptyMessage}
        isLoading={feed.isPending && !rangeError}
        error={feed.isError ? feed.error : null}
        onRetry={feed.refetch}
        isRefreshing={feed.isPlaceholderData}
        serverPaged
      />

      <div className="mt-4 flex items-center justify-between">
        <SecondaryButton
          type="button"
          onClick={() => setFilters({ page: Math.max(1, query.page - 1) })}
          disabled={query.page === 1 || feed.isFetching}
        >
          Previous
        </SecondaryButton>
        <span className="text-sm text-gray-500">Page {query.page}</span>
        <SecondaryButton
          type="button"
          onClick={() => setFilters({ page: query.page + 1 })}
          disabled={!feed.data?.hasMore || feed.isFetching}
        >
          Next
        </SecondaryButton>
      </div>
    </div>
  );
}

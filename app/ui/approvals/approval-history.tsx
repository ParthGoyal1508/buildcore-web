'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import {
  getApprovalHistoryList,
  type ApprovalHistoryEntry,
  type ApprovalHistoryStatus,
  type ApprovalHistoryStep,
  type ApprovalStateName,
} from '@/app/lib/api/approvals';
import { MESSAGES, approvalActionTypeLabel } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import { inlineSelectClass } from '@/app/ui/settings/form-fields';

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

const PAGE_SIZE = 20;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

export default function ApprovalHistory() {
  const [status, setStatus] = useState<ApprovalHistoryStatus>('decided');
  const [scope, setScope] = useState<'visible' | 'mine'>('visible');
  const [module, setModule] = useState('');
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: ['approvalHistoryList', status, scope, module, page],
    queryFn: () =>
      getApprovalHistoryList({
        status,
        scope,
        module: module || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    // Paging keeps the previous page on screen until the next arrives, so the list does
    // not collapse to "Loading…" and jump the reader back to the top.
    placeholderData: keepPreviousData,
  });

  const data = history.data;
  const modules = data?.modules ?? [];
  const allCount = modules.reduce((sum, m) => sum + m.count, 0);

  // Group the page by module, in the order the API lists modules.
  const groups = modules
    .map((m) => ({
      ...m,
      items: (data?.items ?? []).filter((i) => i.module === m.key),
    }))
    .filter((g) => g.items.length > 0);

  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;

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
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setModule('');
                setPage(1);
              }}
              className={clsx(
                'min-h-9 rounded px-3 text-sm font-medium',
                focusRing,
                status === tab.value
                  ? 'bg-blue-600 text-white'
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
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as 'visible' | 'mine');
              setModule('');
              setPage(1);
            }}
          >
            <option value="visible">Everything I can see</option>
            <option value="mine">Only ones I raised or decided</option>
          </select>
        </label>
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
            active={module === ''}
            onClick={() => {
              setModule('');
              setPage(1);
            }}
          />
          {modules.map((m) => (
            <ModuleChip
              key={m.key}
              label={m.label}
              count={m.count}
              active={module === m.key}
              onClick={() => {
                setModule(m.key);
                setPage(1);
              }}
            />
          ))}
        </div>
      )}

      {history.isPending && (
        <p className="text-sm text-gray-500" role="status">
          Loading approvals…
        </p>
      )}
      {history.isError && (
        <p className="text-sm text-red-600" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          {scope === 'mine'
            ? 'Nothing here that you raised or decided.'
            : 'No approvals to show here yet.'}
        </p>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`approval-group-${group.key}`}
          className="space-y-2"
        >
          <h3
            id={`approval-group-${group.key}`}
            className="text-sm font-semibold text-gray-800"
          >
            {group.label}{' '}
            <span className="font-normal text-gray-500">
              ({group.count})
            </span>
          </h3>
          <ul className="space-y-3">
            {group.items.map((item) => (
              <li key={item.instanceId}>
                <HistoryCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || history.isFetching}
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
            onClick={() => setPage((p) => p + 1)}
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
          ? 'border-blue-600 bg-blue-50 text-blue-800'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {label} <span className="text-gray-500">{count}</span>
    </button>
  );
}

const STATE_BADGE: Record<ApprovalStateName, { label: string; cls: string }> =
  {
    pending: { label: 'In progress', cls: 'bg-blue-50 text-blue-800' },
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
                className={`rounded text-blue-700 hover:text-blue-900 hover:underline ${focusRing}`}
              >
                {item.subject}
              </Link>
            ) : (
              item.subject
            )}
          </p>
          <p className="text-xs text-gray-500">
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
          {item.closedAt && (
            <span className="text-xs text-gray-500">
              {dateTimeLabel(item.closedAt)}
            </span>
          )}
        </div>
      </div>

      {item.state === 'pending' && item.awaitingLabel && (
        <p className="mt-2 text-xs text-blue-800">
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
            className={`cursor-pointer rounded text-blue-700 hover:text-blue-900 ${focusRing}`}
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
    dot: 'bg-blue-600 ring-4 ring-blue-100',
    box: 'border-blue-400 bg-blue-50 ring-1 ring-blue-300',
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

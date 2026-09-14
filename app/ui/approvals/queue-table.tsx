'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import {
  decideApproval,
  getApprovalQueue,
  type ApprovalDecisionAction,
  type ApprovalQueueEntry,
} from '@/app/lib/api/approvals';
import {
  APPROVAL_QUEUE_AGE_WARNING_HOURS,
  MESSAGES,
  approvalActionTypeLabel,
} from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import ActionReview from '@/app/ui/approvals/action-review';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { RowAction } from '@/app/ui/settings/form-fields';

/**
 * The cross-module approval queue (spec US3, FR-010 to FR-013).
 *
 * Every row is something this caller can act on **right now**. The server excludes items
 * awaiting somebody else and items this caller has already decided on, and that exclusion
 * is deliberate: a queue that lists work you are forbidden to action teaches people to
 * ignore the queue, which costs more than the missing row ever would.
 *
 * The decision is taken from the row. Opening the item first is available and often right
 * — `subject` is a summary, not the item — but a queue that *required* a round trip to
 * every module before anything could move would be a list of links, not a queue.
 *
 * `subject` and `href` come from the server because the spine holds only an opaque
 * reference to the item it governs. This application must not keep a second mapping from
 * entity type to route: it would have to be kept in step with the backend's forever, and
 * would be wrong first for whichever module was added last.
 */
export default function ApprovalQueue() {
  const queryClient = useQueryClient();
  /** Cursors walked so far, so "load more" appends rather than replacing. */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);

  const pages = useQuery({
    queryKey: ['approvalQueue', cursors],
    queryFn: async () => {
      const results = [];
      for (const cursor of cursors) {
        results.push(await getApprovalQueue({ cursor }));
      }
      return results;
    },
    // FR-013: a decision elsewhere changes this list, and so does a colleague's. Refetching
    // when the tab regains focus is what keeps a queue left open on a second monitor from
    // quietly going stale — without any realtime infrastructure to maintain.
    refetchOnWindowFocus: true,
  });

  const decide = useMutation({
    mutationFn: ({
      instanceId,
      action,
      reason,
    }: {
      instanceId: string;
      action: ApprovalDecisionAction;
      reason?: string;
    }) => decideApproval(instanceId, { action, reason }),
    onSuccess: () => {
      // The item leaves the queue without a manual refresh (FR-013), and the sidenav
      // badge follows it. Invalidating rather than splicing the row out locally: the
      // server decides what is still actionable, and a local guess would be wrong the
      // moment a decision advanced an item to a level this caller also holds.
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
    },
  });

  const items = pages.data?.flatMap((page) => page.items) ?? [];
  const nextCursor = pages.data?.[pages.data.length - 1]?.nextCursor ?? null;

  const columns: Column<ApprovalQueueEntry>[] = [
    {
      key: 'subject',
      header: 'Item',
      sticky: true,
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">
            {row.href ? (
              <Link
                href={row.href}
                className="text-blue-700 hover:text-blue-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                {row.subject}
              </Link>
            ) : (
              // A module with no screen for its item yet. Rendering a dead link would be
              // worse than rendering none.
              row.subject
            )}
          </div>
          <div className="text-xs text-gray-500">
            {approvalActionTypeLabel(row.actionType)}
          </div>
        </div>
      ),
    },
    {
      key: 'requester',
      header: 'Raised by',
      render: (row) => (
        <span className="text-sm text-gray-700">{row.requestedByName}</span>
      ),
    },
    {
      key: 'age',
      header: 'Waiting',
      render: (row) => (
        <span
          className={clsx(
            'text-xs',
            // Two working days. A warning everything triggers is a warning nobody reads,
            // so a normal overnight wait stays neutral.
            row.ageHours >= APPROVAL_QUEUE_AGE_WARNING_HOURS
              ? 'rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900'
              : 'text-gray-600',
          )}
          title={dateTimeLabel(row.requestedAt)}
        >
          {formatAge(row.ageHours)}
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Your level',
      render: (row) => (
        <span className="text-xs text-gray-700">{row.levelLabel}</span>
      ),
    },
    {
      key: 'decide',
      header: 'Decision',
      render: (row) => (
        <ActionReview
          size="inline"
          entityLabel={row.subject}
          // Every row in this list is actionable by construction: the server returned
          // it because this caller can act on it now. Only the fields the control reads
          // are passed — the queue does not know the chain's length and does not pretend
          // to.
          state={{
            instanceId: row.instanceId,
            canActNow: true,
            inertReason: null,
            levelLabel: row.levelLabel,
            awaitingUserName: null,
            currentPosition: row.currentPosition,
          }}
          onDecide={(action, reason) =>
            decide.mutateAsync({ instanceId: row.instanceId, action, reason })
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        caption="Items awaiting your decision"
        columns={columns}
        rows={items}
        rowKey={(row) => row.instanceId}
        isLoading={pages.isLoading}
        error={pages.isError ? MESSAGES.loadFailed : null}
        // Said plainly rather than left as a blank screen (FR-006). "Nothing is waiting on
        // you" is a result; an empty table is indistinguishable from one that failed.
        emptyMessage="Nothing is waiting on you."
      />
      {nextCursor && (
        <RowAction
          type="button"
          onClick={() => setCursors((c) => [...c, nextCursor])}
          disabled={pages.isFetching}
        >
          {pages.isFetching ? 'Loading…' : 'Load more'}
        </RowAction>
      )}
    </div>
  );
}

/**
 * How long an item has been waiting, in words.
 *
 * Hours below a day, days above it. "52 hours" is a number a reader has to convert; "2
 * days" is the thing they actually wanted to know.
 */
function formatAge(hours: number): string {
  if (hours < 1) return 'less than an hour';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

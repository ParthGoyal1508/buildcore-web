'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';

import {
  decideApproval,
  getApprovalQueue,
  type ApprovalDecisionAction,
  type ApprovalQueueEntry,
} from '@/app/lib/api/approvals';
import {
  APPROVAL_QUEUE_AGE_WARNING_HOURS,
  approvalActionTypeLabel,
} from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import ActionReview from '@/app/ui/approvals/action-review';
import ResponsiveList, {
  type Column,
} from '@/app/ui/settings/responsive-list';
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
 *
 * ## Mobile-critical, not merely unbroken (016 FR-021, tasks T108 to T110)
 *
 * The client put this screen on the closed mobile-critical list for one reason: **a Director deciding
 * a payment release from a phone.** That makes approve, reject and return the controls that must be
 * reachable one-handed — not the filters, not the age column.
 *
 * So the queue renders as **cards below `md`** through `ResponsiveList`, not as a horizontally
 * scrolling table. A `DataTable` inside `overflow-x-auto` meets the breakage floor and fails this
 * standard: the decision controls sit in the last column, which at 320px is off-screen to the right,
 * and an approver who has to scroll sideways to find Approve is an approver who approves without
 * reading. On the card they sit at the bottom, under the subject, where a thumb is.
 *
 * `ResponsiveList` renders `actions` in a full-width footer on the card, which is what makes the
 * 44px touch target achievable — `ActionReview` at `size="inline"` is sized for a table cell.
 */
export default function ApprovalQueue() {
  const queryClient = useQueryClient();
  /**
   * 036 D3: an infinite query. "Load more" used to put every cursor walked so far into the query
   * key, so each press made a new key — the list blanked to its loading state and then re-fetched
   * every page from the first. React Query keeps the pages it has and fetches only the next one;
   * a refetch (focus, a decision) re-walks the loaded pages in place without blanking.
   */
  const pages = useInfiniteQuery({
    queryKey: ['approvalQueue'],
    queryFn: ({ pageParam }) => getApprovalQueue({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
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
      // The decision is now part of the history listed under the queue (2026-10-15).
      void queryClient.invalidateQueries({ queryKey: ['approvalHistoryList'] });
      // An approval moves the item on, possibly onto a later step that is "coming up" for this
      // caller — or off that list (036 D4). And the bell's approvals row changes with it.
      void queryClient.invalidateQueries({ queryKey: ['approvalUpcoming'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    },
  });

  const items = pages.data?.pages.flatMap((page) => page.items) ?? [];

  const columns: Column<ApprovalQueueEntry>[] = [
    {
      key: 'subject',
      header: 'Item',
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
  ];

  /**
   * The decision controls, as `ResponsiveList`'s `actions` rather than as a column.
   *
   * A column would put them in a card row labelled "Decision" beside a `<dt>`, cramped into the
   * right half of a 320px card. As `actions` they get the card's full width in their own footer —
   * which is the difference between a reachable control and a technically-present one.
   */
  const decision = (row: ApprovalQueueEntry) => (
    <ActionReview
      size="inline"
      entityLabel={row.subject}
      // Every row in this list is actionable by construction: the server returned it because this
      // caller can act on it now. Only the fields the control reads are passed — the queue does not
      // know the chain's length and does not pretend to.
      state={{
        instanceId: row.instanceId,
        canActNow: true,
        inertReason: null,
        levelLabel: row.levelLabel,
        isFinalAuthority: row.isFinalAuthority,
        awaitingUserName: null,
        currentPosition: row.currentPosition,
      }}
      onDecide={(action, reason) =>
        decide.mutateAsync({ instanceId: row.instanceId, action, reason })
      }
    />
  );

  /**
   * The loaded rows, grouped by module in the order they first appear (2026-10-15).
   *
   * The client asked for approvals grouped by module. The API resolves each row's module
   * from its action type, so grouping here is only a partition — no mapping of action
   * types is kept on this side. Order of first appearance keeps the oldest-first promise:
   * the group holding the most neglected item comes first.
   */
  const groups: { key: string; label: string; rows: ApprovalQueueEntry[] }[] =
    [];
  for (const row of items) {
    let group = groups.find((g) => g.key === row.module);
    if (!group) {
      group = { key: row.module, label: row.moduleLabel, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <ResponsiveList
          columns={columns}
          rows={items}
          rowKey={(row) => row.instanceId}
          actions={decision}
          isLoading={pages.isLoading}
          error={pages.isError ? pages.error : null}
          onRetry={pages.refetch}
          // Said plainly rather than left as a blank screen (FR-006). "Nothing is waiting
          // on you" is a result; an empty table is indistinguishable from one that failed.
          // The history below still shows everything already decided.
          emptyMessage="Nothing is waiting on you."
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
              {group.label}{' '}
              <span className="font-normal text-gray-500">
                ({group.rows.length})
              </span>
            </h3>
            <ResponsiveList
              columns={columns}
              rows={group.rows}
              rowKey={(row) => row.instanceId}
              actions={decision}
              emptyMessage="Nothing is waiting on you."
            />
          </section>
        ))
      )}
      {pages.hasNextPage && (
        <RowAction
          type="button"
          intent="read"
          // `min-h-11` is 44px — the touch target Principle VI's mobile-critical standard requires.
          // `RowAction` is sized for a table cell by default, which is right in a desktop row and too
          // small for a thumb. `intent="read"` because loading the next page writes nothing: without
          // it the control would vanish for a reader, who is exactly who scrolls a queue.
          className="min-h-11 w-full justify-center sm:w-auto"
          onClick={() => void pages.fetchNextPage()}
          loading={pages.isFetchingNextPage}
          disabled={pages.isFetching}
        >
          Load more
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

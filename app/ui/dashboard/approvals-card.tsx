'use client';

import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getApprovalCount, getApprovalQueue } from '@/app/lib/api/approvals';
import {
  APPROVAL_COUNT_POLL_MS,
  ROUTES,
  approvalActionTypeLabel,
} from '@/app/lib/constants';
import { LoadingText } from '@/app/ui/spinner';

/** How many waiting items the Overview shows before "View all". */
const SHOWN = 5;

/** `0.4` → "just now", `5` → "5h", `50` → "2d": how long it has been waiting. */
function waited(hours: number): string {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * What is waiting on the reader's decision, on the Overview (2026-10-15). The client: "Add
 * approvals in the Overview dashboard as well".
 *
 * The same queue the Approvals screen opens with — the items at a level the reader decides —
 * so the two never disagree, and the same query keys, so deciding something on the Approvals
 * screen (which invalidates `approvalQueue` and `approvalCount`) clears it here too. Each row
 * opens the record itself, where the decision is taken in context; "View all" opens the queue.
 * The oldest waiting are the ones at risk, so a long wait is flagged in amber.
 */
export default function ApprovalsCard() {
  const queue = useQuery({
    queryKey: ['approvalQueue', 'overview'],
    queryFn: () => getApprovalQueue({ limit: SHOWN }),
    refetchInterval: APPROVAL_COUNT_POLL_MS,
  });
  const count = useQuery({
    queryKey: ['approvalCount'],
    queryFn: getApprovalCount,
    refetchInterval: APPROVAL_COUNT_POLL_MS,
  });

  const items = queue.data?.items ?? [];
  const total = count.data?.count ?? items.length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          Awaiting your approval
          {total > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {total}
            </span>
          )}
        </h2>
        <Link
          href={ROUTES.approvals}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          View all →
        </Link>
      </div>

      {queue.isPending ? (
        <p className="px-4 py-4 text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : queue.isError ? (
        <p className="px-4 py-4 text-sm text-red-700" role="alert">
          Could not load your approvals.
        </p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-5 text-sm text-gray-500">
          <CheckCircleIcon
            className="h-5 w-5 text-emerald-500"
            aria-hidden="true"
          />
          Nothing is waiting for you.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-gray-900">
                    {item.subject}
                  </p>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-xs ${
                      item.ageHours >= 48
                        ? 'font-medium text-amber-700'
                        : 'text-gray-500'
                    }`}
                    title={`Waiting since ${new Date(item.requestedAt).toLocaleString()}`}
                  >
                    <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {waited(item.ageHours)}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">
                    {item.moduleLabel}
                  </span>
                  <span>{approvalActionTypeLabel(item.actionType)}</span>
                  <span aria-hidden="true">·</span>
                  <span>by {item.requestedByName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.levelLabel}</span>
                </p>
              </>
            );
            return (
              <li key={item.instanceId}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block px-4 py-2.5 transition-colors hover:bg-brand-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getApprovalHistory } from '@/app/lib/api/approvals';
import type { ApprovalState } from '@/app/lib/api/approvals';
import { MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';

/**
 * The full ordered decision history for one record (spec FR-009).
 *
 * A **disclosure on the record**, not a link to a separate page. The requirement is that
 * the answer is in that place — someone reading a rejection wants to know what happened
 * before it without losing the thing they were reading.
 *
 * Fetched lazily, on open. The history is the minority case on most rows and pulling it
 * for every item in a list to render a collapsed summary would be an N+1 against the spine
 * that nobody would see until a list got long.
 *
 * Earlier rounds are shown too. An item returned and resubmitted keeps every decision it
 * collected the first time round, because the record must show that it went round — which
 * is precisely what `returnCount` quantifies and what this list evidences.
 */

const VERB: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  return: 'Returned for correction',
};

export default function DecisionHistory({
  state,
  /** Kept out of `state` so an item with no chain can still render nothing gracefully. */
  entityType,
  entityId,
}: {
  state: ApprovalState | null;
  entityType: string;
  entityId: string;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['approvalHistory', entityType, entityId],
    queryFn: () => getApprovalHistory(entityType, entityId),
    enabled: open,
  });

  // An item never acted on has no history to disclose, and offering a control that opens
  // to nothing is worse than offering none.
  if (!state?.latestDecision) return null;

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        {open ? 'Hide history' : 'Show full history'}
        {state.returnCount > 0 ? ` (returned ${state.returnCount}×)` : ''}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && <p className="text-gray-500">Loading…</p>}
          {isError && (
            <p role="alert" className="text-red-700">
              {MESSAGES.loadFailed}
            </p>
          )}
          {data && data.length > 0 && (
            <ol className="space-y-2 border-l border-gray-200 pl-3">
              {data.map((entry, index) => (
                <li
                  key={`${entry.round}-${entry.position}-${index}`}
                  className="text-gray-700"
                >
                  <span className="font-medium text-gray-900">
                    {VERB[entry.action] ?? entry.action}
                  </span>{' '}
                  by {entry.actorName} at {entry.levelLabel} ·{' '}
                  {dateTimeLabel(entry.decidedAt)}
                  {/* Only shown once the item has gone round at least once. On a
                      first-round item the number would be noise on every line. */}
                  {entry.round > 1 && (
                    <span className="ml-1 text-gray-500">
                      (round {entry.round})
                    </span>
                  )}
                  {entry.reason && (
                    // The reason is the part everyone who approved earlier needs to see
                    // when a later level overrides them.
                    <p className="mt-0.5 text-gray-600">“{entry.reason}”</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          {data && data.length === 0 && (
            <p className="text-gray-500">No decisions recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

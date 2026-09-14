'use client';

import type { ApprovalState } from '@/app/lib/api/approvals';
import { dateTimeLabel } from '@/app/lib/format';

/**
 * The most recent act on a record — who, what and when (spec FR-008).
 *
 * Rendered **on the record itself**, not behind a link. The requirement is that a reviewer
 * can name who acted and when without navigating away; a link satisfies the letter of that
 * and not the point of it.
 *
 * `actorName` comes from the server and resolves even for a deactivated account. This
 * component must never substitute anything for it: "Unknown user" against an approval that
 * a real person gave is the kind of gap that makes an audit trail worth less than no audit
 * trail.
 */

const VERB: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  return: 'Returned',
};

export default function LastAction({
  state,
}: {
  /** Null for an item with no chain at all — see the caller's own handling. */
  state: ApprovalState | null;
}) {
  // Nothing has happened, so nothing is implied (spec US2 scenario 3). Rendering an em
  // dash or "no action" would both read as a status the item does not have.
  if (!state?.latestDecision) return null;

  const { action, actorName, decidedAt, levelLabel } = state.latestDecision;

  return (
    <span className="text-xs text-gray-600">
      <span className="font-medium text-gray-800">
        {VERB[action] ?? action}
      </span>{' '}
      by {actorName}
      {levelLabel ? ` (${levelLabel})` : ''} · {dateTimeLabel(decidedAt)}
      {state.returnCount > 0 && (
        // FR-020: repetition must leave a visible trace. A chain worn down by being
        // returned and resubmitted four times reads very differently from one approved
        // first time, and the count is the only thing that says so at a glance.
        <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
          returned {state.returnCount}×
        </span>
      )}
    </span>
  );
}

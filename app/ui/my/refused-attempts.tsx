'use client';

import { useQuery } from '@tanstack/react-query';

import {
  getMyRefusedAttempts,
  type RefusedAttempt,
} from '@/app/lib/api/my-workspace';
import { MESSAGES, REFUSED_ATTEMPTS } from '@/app/lib/constants';
import {
  isFaceRefusal,
  punchRefusalReasonMessage,
} from '@/app/lib/punch-refusal';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

/**
 * The worker's own refused punches (020 FR-012, T026).
 *
 * **Attempts, not days.** Three refusals on one morning are three rows, because the question this
 * answers is "what happened when I tried", and collapsing them into a day would lose the only
 * thing that makes the list useful — that it was tried, repeatedly, and why.
 *
 * **Deliberately not in the attendance view** (T027). A refused punch wrote nothing to attendance
 * (backend FR-013d), and putting it on the calendar would recreate exactly the refused day the
 * backend refuses to keep: a reader seeing it there would take it for a day with a problem, when it
 * is a day with no punch and an explanation. A worker refused at 8am and asking at 5pm needs
 * somewhere to look, and this is that somewhere.
 *
 * Nothing here can be resolved, appealed or dismissed — the backend's position, and the right one:
 * a refused punch is not a work item, because the punch does not exist. The way back is a
 * correction somebody raises and somebody reviews, which the empty-state and the footnote both say.
 */
export default function RefusedAttempts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'punch-refusals'],
    queryFn: getMyRefusedAttempts,
  });

  const columns: Column<RefusedAttempt>[] = [
    {
      key: 'when',
      header: REFUSED_ATTEMPTS.columnWhen,
      render: (row) => (
        <span className="whitespace-nowrap">
          {new Date(row.capturedAt).toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'type',
      header: REFUSED_ATTEMPTS.columnType,
      render: (row) =>
        row.type === 'in' ? REFUSED_ATTEMPTS.punchIn : REFUSED_ATTEMPTS.punchOut,
    },
    {
      key: 'reason',
      header: REFUSED_ATTEMPTS.columnReason,
      // The same sentence the worker saw at the gate. Two wordings for one refusal would make
      // them doubt they are reading about the same attempt.
      render: (row) => (
        <div className="space-y-1">
          <p>{punchRefusalReasonMessage(row.reason)}</p>
          {isFaceRefusal(row.reason) && (
            <p className="text-xs text-gray-500">
              {MESSAGES.punchRefusedNoPhoto}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900">
        {REFUSED_ATTEMPTS.heading}
      </h2>
      <p className="mb-2 text-xs text-gray-500">{REFUSED_ATTEMPTS.subheading}</p>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? REFUSED_ATTEMPTS.loadFailed : null}
        emptyMessage={REFUSED_ATTEMPTS.empty}
      />
    </section>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { resubmitApproval } from '@/app/lib/api/approvals';
import {
  getMyPunchExceptions,
  type MyPunchException,
} from '@/app/lib/api/my-workspace';
import { MY_PUNCH_EXCEPTIONS } from '@/app/lib/constants';
import ActionReview from '@/app/ui/approvals/action-review';
import LastAction from '@/app/ui/approvals/last-action';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

/**
 * The worker's own flagged punches (016 FR-005, T042).
 *
 * **The only approval surface in the product that belongs to the person who raised the
 * item rather than to a reviewer.** Attendance exceptions record the punching employee as
 * the approval's originator, so when an approver returns one for correction it is
 * returned to them — and until this existed there was nowhere for that to land. The
 * queue lists what awaits you *as an approver*, and the exceptions modal is an
 * administrator's screen; a worker appears in neither.
 *
 * `ActionReview` unmodified, as everywhere else. It renders nothing at all for a punch
 * still travelling — correct, because the worker is not being asked to decide — and the
 * resubmit affordance only when the server says `canResubmitNow`.
 */
export default function PunchExceptions() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'punch-exceptions'],
    queryFn: getMyPunchExceptions,
  });

  const resubmit = useMutation({
    mutationFn: (row: MyPunchException) =>
      resubmitApproval(row.approval!.entityType, row.approval!.entityId),
    onSuccess: () => {
      // The punch's own state and the badge both move: a resubmitted item re-enters
      // somebody's queue. Invalidating rather than patching keeps this screen from
      // disagreeing with a state the server owns.
      void queryClient.invalidateQueries({
        queryKey: ['my', 'punch-exceptions'],
      });
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
    },
  });

  const columns: Column<MyPunchException>[] = [
    {
      key: 'when',
      header: 'Punch',
      render: (row) => (
        <span className="whitespace-nowrap">
          {new Date(row.punch.capturedAt).toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          <span className="ml-1 text-gray-500">
            ({row.punch.type === 'in' ? 'in' : 'out'})
          </span>
        </span>
      ),
    },
    {
      key: 'why',
      header: 'Why',
      render: (row) => reasonFor(row.punch),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) =>
        row.approval ? (
          <LastAction state={row.approval} />
        ) : (
          <span className="text-xs text-amber-800">
            {MY_PUNCH_EXCEPTIONS.notInChain}
          </span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) =>
        row.approval ? (
          <ActionReview
            size="inline"
            state={row.approval}
            entityLabel="this punch"
            // Deliberately no `onDecide` that can succeed: a worker never decides their
            // own exception, and the server would refuse them. The control only offers
            // the resubmit branch here because `canActNow` is false for them throughout.
            onDecide={() => Promise.reject(new Error('Not yours to decide'))}
            onResubmit={() => resubmit.mutateAsync(row)}
          />
        ) : null,
    },
  ];

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        {MY_PUNCH_EXCEPTIONS.heading}
      </h2>
      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.punch.id}
        isLoading={isLoading}
        error={isError ? MY_PUNCH_EXCEPTIONS.loadFailed : null}
        emptyMessage={MY_PUNCH_EXCEPTIONS.empty}
      />
    </section>
  );
}

/** Why this punch was flagged, in the worker's words rather than the system's. */
function reasonFor(punch: MyPunchException['punch']): string {
  const offSite = punch.geofenceResult === 'exception';
  const badFace = punch.faceMatchResult === 'no_match';
  const { reasons } = MY_PUNCH_EXCEPTIONS;
  if (offSite && badFace) return reasons.both;
  if (offSite) return reasons.geofence;
  if (badFace) return reasons.face;
  return reasons.unknown;
}

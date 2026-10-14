'use client';

import { useQuery } from '@tanstack/react-query';

import { decideApproval, resubmitApproval } from '@/app/lib/api/approvals';
import { getWorkOrderApproval } from '@/app/lib/api/billing';
import ActionReview from '@/app/ui/approvals/action-review';

/**
 * Approve / Reject on the work order itself (2026-10-14), for the person whose turn it is.
 *
 * The award was only decidable from the Approvals inbox, so a director looking at the work order
 * waiting on them saw "Waiting for approval" and no way to give it. `ActionReview` is imported, not
 * reimplemented — it is the one approval display, the same one a bill package shows.
 */
export default function WorkOrderApproval({
  workOrderId,
  label,
  onChanged,
  onNotice,
}: {
  workOrderId: string;
  label: string;
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const { data: approval, refetch } = useQuery({
    queryKey: ['workOrderApproval', workOrderId],
    queryFn: () => getWorkOrderApproval(workOrderId),
  });
  if (!approval) return null;

  const refresh = () => {
    void refetch();
    onChanged();
    // The chain's completion moves the work order on the server a moment after the decision.
    setTimeout(onChanged, 800);
  };

  return (
    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      <ActionReview
        state={approval}
        entityLabel={`work order ${label}`}
        size="full"
        onDecide={async (action, reason) => {
          await decideApproval(approval.instanceId, { action, reason });
          onNotice(
            action === 'approve'
              ? 'Approval recorded.'
              : action === 'reject'
              ? 'Rejected — the award is back with its author.'
              : 'Returned to the author for correction.',
          );
          refresh();
        }}
        onResubmit={async () => {
          await resubmitApproval('work_order_award', workOrderId);
          onNotice('Sent back up the chain.');
          refresh();
        }}
      />
    </div>
  );
}

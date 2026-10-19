'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { errorMessage } from '@/app/lib/api/client';
import {
  cancelLeaveApplication,
  getLeaveApplications,
  requestStage,
  type LeaveApplication,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { confirmDialog } from '@/app/ui/dialogs';
import { RowAction } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { LEAVE_TYPE_LABEL } from '@/app/ui/my/leave-balance';
import { dateLabel } from '@/app/lib/format';

const STATUS_CLASS: Record<LeaveApplication['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const shortDate = (value: string) => dateLabel(value.slice(0, 10));

export default function LeaveApplications() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my', 'leave-applications'],
    queryFn: getLeaveApplications,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelLeaveApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'leave-applications'] });
      // The balance a pending application held is released by the cancel.
      queryClient.invalidateQueries({ queryKey: ['my', 'leave-balance'] });
      toast.success('Leave application cancelled');
    },
    // A 409 means someone decided it between the page loading and the tap.
    onError: (err: unknown) =>
      toast.error(errorMessage(err, MESSAGES.saveFailed)),
  });

  // 036 G4: one tap used to cancel at once, with no undo — a thumb brushing the row on a phone
  // withdrew the application and the employee had to apply again from scratch.
  async function confirmCancel(row: LeaveApplication) {
    const ok = await confirmDialog({
      title: 'Cancel this leave application?',
      message: `${LEAVE_TYPE_LABEL[row.leaveType]}, ${shortDate(row.fromDate)} – ${shortDate(row.toDate)}. You would need to apply again.`,
      confirmLabel: 'Cancel application',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (ok) cancel.mutate(row.id);
  }

  const columns: Column<LeaveApplication>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => LEAVE_TYPE_LABEL[row.leaveType],
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (row) => (
        <span className="whitespace-nowrap">
          {shortDate(row.fromDate)} – {shortDate(row.toDate)}
        </span>
      ),
    },
    { key: 'days', header: 'Days', render: (row) => row.dayCount },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => row.reason,
      hideOnCard: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              STATUS_CLASS[row.status],
            )}
          >
            {row.status}
          </span>
          {/* Where a pending application is (2026-10-16): the reporting manager decides first. */}
          {row.status === 'pending' && (
            <p className="mt-1 text-xs text-gray-500">
              {requestStage(row) === 'manager'
                ? 'With your reporting manager'
                : 'With HR'}
            </p>
          )}
          {row.managerRemarks && row.managerRemarks !== row.adminRemarks && (
            <p className="mt-1 text-xs text-gray-500">
              Manager: {row.managerRemarks}
            </p>
          )}
          {/* Remarks matter most on a rejection — being told "no" without a reason
              gives the employee nothing to act on. */}
          {row.adminRemarks && (
            <p className="mt-1 text-xs text-gray-500">{row.adminRemarks}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-medium text-gray-900">
        My applications
      </h2>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        skeletonRows={3}
        emptyMessage="You have not applied for any leave yet."
        actions={(row) =>
          // Only a pending application can be cancelled (FR-012). Rendering a
          // disabled Cancel on a decided one would suggest it might become
          // available; it never will.
          row.status === 'pending' ? (
            <RowAction
              type="button"
              onClick={() => void confirmCancel(row)}
              loading={cancel.isPending && cancel.variables === row.id}
              disabled={cancel.isPending}
              className="text-red-600"
            >
              Cancel
            </RowAction>
          ) : null
        }
      />
    </section>
  );
}

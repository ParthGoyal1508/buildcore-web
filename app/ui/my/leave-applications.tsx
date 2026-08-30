'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import { ApiError } from '@/app/lib/api/client';
import {
  cancelLeaveApplication,
  getLeaveApplications,
  type LeaveApplication,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { LEAVE_TYPE_LABEL } from '@/app/ui/my/leave-balance';

const STATUS_CLASS: Record<LeaveApplication['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const shortDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

export default function LeaveApplications() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'leave-applications'],
    queryFn: getLeaveApplications,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelLeaveApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'leave-applications'] });
      setError(null);
    },
    // A 409 means someone decided it between the page loading and the tap.
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

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
    { key: 'reason', header: 'Reason', render: (row) => row.reason, hideOnCard: true },
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
      <h2 className="mb-3 text-lg font-medium text-gray-900">My applications</h2>
      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="You have not applied for any leave yet."
        actions={(row) =>
          // Only a pending application can be cancelled (FR-012). Rendering a
          // disabled Cancel on a decided one would suggest it might become
          // available; it never will.
          row.status === 'pending' ? (
            <RowAction
              type="button"
              onClick={() => cancel.mutate(row.id)}
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

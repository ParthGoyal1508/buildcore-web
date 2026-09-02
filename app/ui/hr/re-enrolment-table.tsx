'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  decideReEnrolment,
  listReEnrolmentRequests,
  type ReEnrolmentRequest,
} from '@/app/lib/api/hr-payroll';
import { MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';

/**
 * Biometric re-enrolment review (005 US10).
 *
 * Approving opens a time-limited window in which the employee may re-enrol their
 * face; the expiry is shown because an approval nobody uses in time simply lapses,
 * and an admin re-approving a request that has already expired is the common
 * confusion here.
 */
export default function ReEnrolmentTable() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'reEnrolment'],
    queryFn: listReEnrolmentRequests,
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => decideReEnrolment(id, decision, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr', 'reEnrolment'] }),
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<ReEnrolmentRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.employeeName ?? row.employeeCode ?? row.employeeId,
    },
    { key: 'reason', header: 'Reason given', render: (row) => row.reason ?? '—' },
    {
      key: 'requested',
      header: 'Requested',
      render: (row) => dateTimeLabel(row.requestedAt),
    },
    {
      key: 'expires',
      header: 'Approval expires',
      render: (row) => dateTimeLabel(row.expiresAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      <DataTable
        caption="Biometric re-enrolment requests"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No re-enrolment requests."
        actions={(row) =>
          row.status === 'pending' ? (
            <>
              <RowAction
                type="button"
                onClick={() => decide.mutate({ id: row.id, decision: 'approved' })}
              >
                Approve
              </RowAction>
              <RowAction
                type="button"
                onClick={() => {
                  const reason = window.prompt('Why is this request being rejected?');
                  if (reason?.trim()) {
                    decide.mutate({
                      id: row.id,
                      decision: 'rejected',
                      reason: reason.trim(),
                    });
                  }
                }}
              >
                Reject
              </RowAction>
            </>
          ) : (
            <span className="text-xs text-gray-400">Decided</span>
          )
        }
      />
    </div>
  );
}

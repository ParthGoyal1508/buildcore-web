'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  decideLeaveApplication,
  listLeaveApplications,
  type LeaveApplication,
} from '@/app/lib/api/hr-payroll';
import {
  HR_MESSAGES,
  LEAVE_APPLICATION_STATUSES,
  MESSAGES,
  hrLabel,
} from '@/app/lib/constants';
import { dateLabel, money } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The approve/reject dialog.
 *
 * A rejection cannot be submitted without a remark. The employee reads it, and
 * "rejected" with no reason is the single most common support ticket a leave
 * screen generates — so the constraint is enforced here rather than left to
 * whoever happens to be conscientious.
 */
function DecisionModal({
  application,
  decision,
  onClose,
}: {
  application: LeaveApplication;
  decision: 'approved' | 'rejected';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rejecting = decision === 'rejected';
  const canSubmit = !rejecting || remarks.trim().length > 0;

  const decide = useMutation({
    mutationFn: () =>
      decideLeaveApplication(application.id, decision, remarks.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leaveApplications'] });
      // An approved leave changes the attendance status of the days it covers.
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      title={rejecting ? 'Reject leave application' : 'Approve leave application'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => decide.mutate()}
            disabled={!canSubmit || decide.isPending}
          >
            {decide.isPending ? 'Saving…' : rejecting ? 'Reject' : 'Approve'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Employee</dt>
            <dd>{application.employeeName ?? application.employeeId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Leave type</dt>
            <dd>{hrLabel(application.leaveType)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Dates</dt>
            <dd>
              {dateLabel(application.fromDate)} – {dateLabel(application.toDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Days</dt>
            <dd className="tabular-nums">{money(application.days)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Reason</dt>
            <dd>{application.reason ?? '—'}</dd>
          </div>
        </dl>
        <TextField
          id="leave-remarks"
          label={rejecting ? 'Reason for rejection (required)' : 'Remarks (optional)'}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          error={
            rejecting && remarks.trim().length === 0
              ? HR_MESSAGES.rejectNeedsRemarks
              : undefined
          }
          hint="The employee sees this."
        />
      </div>
    </Modal>
  );
}

export default function LeaveApplicationsTable() {
  const [status, setStatus] = useState<string>('pending');
  const [pending, setPending] = useState<{
    application: LeaveApplication;
    decision: 'approved' | 'rejected';
  } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'leaveApplications', status],
    queryFn: () =>
      listLeaveApplications(
        status
          ? { status: status as (typeof LEAVE_APPLICATION_STATUSES)[number] }
          : {},
      ),
  });

  const columns: Column<LeaveApplication>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.employeeName ?? row.employeeCode ?? row.employeeId,
    },
    { key: 'type', header: 'Leave type', render: (row) => hrLabel(row.leaveType) },
    {
      key: 'dates',
      header: 'From – To',
      render: (row) => `${dateLabel(row.fromDate)} – ${dateLabel(row.toDate)}`,
    },
    { key: 'days', header: 'Days', numeric: true, render: (row) => money(row.days) },
    { key: 'reason', header: 'Reason', render: (row) => row.reason ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'remarks', header: 'Remarks', render: (row) => row.remarks ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <SelectField
          id="leave-status"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {LEAVE_APPLICATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {hrLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <DataTable
        caption="Leave applications"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No leave applications match this filter."
        actions={(row) =>
          // Only a pending application can be decided; anything else is history.
          row.status === 'pending' ? (
            <>
              <RowAction
                type="button"
                onClick={() => setPending({ application: row, decision: 'approved' })}
              >
                Approve
              </RowAction>
              <RowAction
                type="button"
                onClick={() => setPending({ application: row, decision: 'rejected' })}
              >
                Reject
              </RowAction>
            </>
          ) : (
            <span className="text-xs text-gray-400">Decided</span>
          )
        }
      />

      {pending && (
        <DecisionModal
          application={pending.application}
          decision={pending.decision}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

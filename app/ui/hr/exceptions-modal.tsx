'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApprovalDecisionAction } from '@/app/lib/api/approvals';
import {
  getPendingAttendanceExceptions,
  resolveAttendanceException,
  type AttendanceExceptionRow,
} from '@/app/lib/api/hr-payroll';
import { MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import ActionReview from '@/app/ui/approvals/action-review';
import DecisionHistory from '@/app/ui/approvals/decision-history';
import LastAction from '@/app/ui/approvals/last-action';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Unresolved face-match and geofence exceptions, and the decision on each.
 *
 * Read-only before feature 016, on the reasoning that resolving one belonged on the punch
 * itself. That reasoning was sound for a single-step confirmation and is wrong for a
 * chain: an exception now travels Site / Employer → HR → Director, and the people at
 * levels two and three have no interest in the punch screen. They have a queue of
 * decisions, and this is where they make them.
 *
 * The control is `<ActionReview>`, unmodified. Nothing here tells it that it is rendering
 * an attendance exception, because the moment one module can, they all diverge.
 */

/**
 * The chain's three decisions, expressed in the vocabulary this endpoint already speaks.
 *
 * The route and its verbs are unchanged from before 016 so the interface changed once
 * rather than twice. The mapping lives here, at the one place that calls the endpoint,
 * rather than inside the shared control — a control that knew about `confirmed` would be
 * a control that knew about attendance.
 */
const RESOLUTION_FOR_ACTION: Record<
  ApprovalDecisionAction,
  'confirmed' | 'rejected' | 'returned'
> = {
  approve: 'confirmed',
  reject: 'rejected',
  return: 'returned',
};

export default function ExceptionsModal({ onClose }: { onClose: () => void }) {
  const employees = useEmployeeNames();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'attendanceExceptions'],
    queryFn: getPendingAttendanceExceptions,
  });

  const decide = useMutation({
    mutationFn: ({
      punchId,
      action,
      reason,
    }: {
      punchId: string;
      action: ApprovalDecisionAction;
      reason?: string;
    }) =>
      resolveAttendanceException(punchId, {
        resolution: RESOLUTION_FOR_ACTION[action],
        reason,
      }),
    onSuccess: () => {
      // The list and the badge both change: an item that advanced may have left this
      // caller's queue entirely. Invalidating rather than patching keeps the two from
      // disagreeing about a state the server owns.
      void queryClient.invalidateQueries({
        queryKey: ['hr', 'attendanceExceptions'],
      });
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue'] });
    },
  });

  const columns: Column<AttendanceExceptionRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => employees.label(row.punch.employeeId),
    },
    {
      key: 'time',
      header: 'Captured at',
      render: (row) => dateTimeLabel(row.punch.capturedAt),
    },
    {
      key: 'face',
      header: 'Face match',
      render: (row) => (
        <StatusBadge status={row.punch.faceMatchResult ?? undefined} />
      ),
    },
    {
      key: 'geofence',
      header: 'Geofence',
      render: (row) => (
        <StatusBadge status={row.punch.geofenceResult ?? undefined} />
      ),
    },
    {
      key: 'level',
      header: 'Awaiting',
      render: (row) =>
        row.approval?.levelLabel ? (
          <span className="text-xs text-gray-700">
            {row.approval.levelLabel}
            {row.approval.totalLevels > 1
              ? ` · ${row.approval.currentPosition} of ${row.approval.totalLevels}`
              : ''}
          </span>
        ) : (
          // A punch flagged before this feature shipped, or one whose company has no
          // chain configured. Saying so beats an empty cell that reads as "nothing to do".
          <span className="text-xs text-gray-400">Not in a chain</span>
        ),
    },
    {
      key: 'last',
      header: 'Last action',
      render: (row) => (
        <div className="space-y-1">
          <LastAction state={row.approval} />
          {/* The full sequence, disclosed in place. Someone reading a rejection wants to
              know what happened before it without losing the row they were reading. */}
          <DecisionHistory
            state={row.approval}
            entityType="attendance_exception"
            entityId={row.punch.id}
          />
        </div>
      ),
    },
    {
      key: 'decide',
      header: 'Decision',
      render: (row) =>
        row.approval ? (
          <ActionReview
            size="inline"
            state={row.approval}
            entityLabel="this attendance exception"
            onDecide={(action, reason) =>
              decide.mutateAsync({ punchId: row.punch.id, action, reason })
            }
          />
        ) : null,
    },
  ];

  return (
    <Modal
      title="Attendance exceptions"
      onClose={onClose}
      wide
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <DataTable
        caption="Attendance exceptions"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.punch.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No unresolved exceptions."
      />
    </Modal>
  );
}

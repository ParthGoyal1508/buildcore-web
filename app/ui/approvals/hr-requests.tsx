'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approveClaim,
  decideLeaveApplication,
  listAdminClaims,
  listLeaveApplications,
  rejectClaim,
  type AdminClaim,
  type LeaveApplication,
} from '@/app/lib/api/hr-payroll';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { dateLabel, money } from '@/app/lib/format';
import { promptDialog } from '@/app/ui/dialogs';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { LoadingText } from '@/app/ui/spinner';

const LEAVE_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  casual: 'Casual leave',
  sick: 'Sick leave',
  lwp: 'Leave without pay',
};

/**
 * Leave applications and reimbursement claims awaiting a decision (2026-10-15).
 *
 * The client: "in the approval tab we are not seeing the leave approvals". Neither travels
 * through the approvals spine — each has its own single-step review, on its own HR screen — so the
 * cross-module queue above never listed them, and an approver had to know to look elsewhere. They
 * are gathered here with the same Approve / Reject on each row, decided through the endpoints
 * their own screens use, so a decision taken here is exactly the one taken there.
 *
 * Each list shows only to someone who may decide it: leave to `ATTENDANCE`, claims to
 * `EMPLOYEES` — the permissions their screens and the server's own guards ask for.
 *
 * 036 (stream 3b): deciding a claim now needs `PAYROLL` write on the API, while reading the queue
 * still needs `EMPLOYEES` or `PAYROLL`. So the claims list shows to either, and Approve / Reject
 * only to a `PAYROLL` writer — an `EMPLOYEES`-only holder would otherwise be offered buttons that
 * answer 403.
 */
export default function HrRequests() {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const permissions = user.data?.permissions ?? [];
  const mayLeave = permissions.includes('ATTENDANCE');
  const mayClaims =
    permissions.includes('EMPLOYEES') || permissions.includes('PAYROLL');
  const mayDecideClaims = hasWrite(user.data, 'PAYROLL');
  if (!mayLeave && !mayClaims) return null;
  return (
    <div className="space-y-6">
      {mayLeave && <LeaveRequests />}
      {mayClaims && <ClaimRequests mayDecide={mayDecideClaims} />}
    </div>
  );
}

function LeaveRequests() {
  const queryClient = useQueryClient();
  const employees = useEmployeeNames();
  const [error, setError] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ['approvals', 'leave', 'pending'],
    queryFn: () => listLeaveApplications({ status: 'pending' }),
    refetchOnWindowFocus: true,
  });
  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'approved' | 'rejected';
      remarks?: string;
    }) => decideLeaveApplication(input.id, input.decision, input.remarks),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'leave'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record that decision.',
      ),
  });

  const columns: Column<LeaveApplication>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) =>
        row.employeeName
          ? `${row.employeeName}${row.employeeCode ? ` · ${row.employeeCode}` : ''}`
          : employees.label(row.employeeId),
    },
    {
      key: 'leave',
      header: 'Leave',
      render: (row) => (
        <div>
          <div className="text-gray-900">
            {LEAVE_LABELS[row.leaveType] ?? row.leaveType} ·{' '}
            {Number(row.dayCount)} day{Number(row.dayCount) === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-gray-500">
            {dateLabel(row.fromDate)} – {dateLabel(row.toDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => row.reason ?? '—',
    },
  ];

  return (
    <section aria-labelledby="approvals-leave" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="approvals-leave"
          className="text-base font-semibold text-gray-900"
        >
          Leave applications
        </h2>
        <Link
          href="/dashboard/hr/leave"
          className="text-sm text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Open leave
        </Link>
      </div>
      <FormError message={error} />
      {isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : isError ? (
        <p className="text-sm text-red-700" role="alert">
          Could not load leave applications.
        </p>
      ) : (
        <ResponsiveList
          columns={columns}
          rows={data}
          rowKey={(row) => row.id}
          emptyMessage="No leave applications are waiting."
          actions={(row) => (
            <>
              <RowAction
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({ id: row.id, decision: 'approved' })
                }
              >
                Approve
              </RowAction>
              <RowAction
                disabled={decide.isPending}
                onClick={async () => {
                  // The employee reads the reason; a rejection without one is not accepted.
                  const remarks = await promptDialog({
                    title: 'Reject this leave?',
                    message: 'The employee will see your reason.',
                    label: 'Reason',
                    required: true,
                    multiline: true,
                    confirmLabel: 'Reject',
                  });
                  if (remarks) {
                    decide.mutate({
                      id: row.id,
                      decision: 'rejected',
                      remarks,
                    });
                  }
                }}
              >
                Reject
              </RowAction>
            </>
          )}
        />
      )}
    </section>
  );
}

function ClaimRequests({ mayDecide }: { mayDecide: boolean }) {
  const queryClient = useQueryClient();
  const employees = useEmployeeNames();
  const [error, setError] = useState<string | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ['approvals', 'claims', 'submitted'],
    queryFn: () => listAdminClaims({ status: 'submitted' }),
    refetchOnWindowFocus: true,
  });
  const decide = useMutation({
    mutationFn: (input: { id: string; approve: boolean; remarks?: string }) =>
      input.approve
        ? approveClaim(input.id, input.remarks)
        : rejectClaim(input.id, input.remarks ?? ''),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'claims'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationCount'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record that decision.',
      ),
  });

  const columns: Column<AdminClaim>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <div>
          <div className="text-gray-900">{money(Number(row.amount))}</div>
          <div className="text-xs text-gray-500">
            {dateLabel(row.expenseDate ?? null)}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'For',
      render: (row) => row.description ?? '—',
    },
  ];

  return (
    <section aria-labelledby="approvals-claims" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="approvals-claims"
          className="text-base font-semibold text-gray-900"
        >
          Reimbursement claims
        </h2>
        <Link
          href="/dashboard/hr/reimbursements"
          className="text-sm text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Open reimbursements
        </Link>
      </div>
      <FormError message={error} />
      {isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : isError ? (
        <p className="text-sm text-red-700" role="alert">
          Could not load reimbursement claims.
        </p>
      ) : (
        <ResponsiveList
          columns={columns}
          rows={data}
          rowKey={(row) => row.id}
          emptyMessage="No reimbursement claims are waiting."
          actions={!mayDecide ? undefined : (row) => (
            <>
              <RowAction
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: row.id, approve: true })}
              >
                Approve
              </RowAction>
              <RowAction
                disabled={decide.isPending}
                onClick={async () => {
                  const remarks = await promptDialog({
                    title: 'Reject this claim?',
                    message: 'The employee will see your reason.',
                    label: 'Reason',
                    required: true,
                    multiline: true,
                    confirmLabel: 'Reject',
                  });
                  if (remarks) {
                    decide.mutate({ id: row.id, approve: false, remarks });
                  }
                }}
              >
                Reject
              </RowAction>
            </>
          )}
        />
      )}
    </section>
  );
}

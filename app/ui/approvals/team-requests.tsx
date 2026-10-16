'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  decideTeamClaim,
  decideTeamLeave,
  listTeamClaims,
  listTeamLeave,
  type TeamClaim,
  type TeamLeave,
} from '@/app/lib/api/my-workspace';
import { APPROVAL_COUNT_POLL_MS } from '@/app/lib/constants';
import { dateLabel, money } from '@/app/lib/format';
import { promptDialog } from '@/app/ui/dialogs';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

const LEAVE_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  casual: 'Casual leave',
  sick: 'Sick leave',
  lwp: 'Leave without pay',
};

/** The team queues' query keys, shared with the approvals badge so the two read one cache. */
export const TEAM_LEAVE_KEY = ['approvals', 'team', 'leave'] as const;
export const TEAM_CLAIMS_KEY = ['approvals', 'team', 'claims'] as const;

export function useTeamLeave() {
  return useQuery({
    queryKey: TEAM_LEAVE_KEY,
    queryFn: listTeamLeave,
    refetchInterval: APPROVAL_COUNT_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useTeamClaims() {
  return useQuery({
    queryKey: TEAM_CLAIMS_KEY,
    queryFn: listTeamClaims,
    refetchInterval: APPROVAL_COUNT_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

const who = (row: {
  employeeName?: string | null;
  employeeCode?: string | null;
}) =>
  row.employeeName
    ? `${row.employeeName}${row.employeeCode ? ` · ${row.employeeCode}` : ''}`
    : (row.employeeCode ?? '—');

/**
 * Leave and expense claims from the people who report to this user (2026-10-16: "first go to
 * reporting manager and then HR").
 *
 * Approving passes a request on to HR, who make the final decision; rejecting ends it, with the
 * reason shown to the employee. Rendered for everyone and empty for most — a manager is anybody
 * named as someone's reporting manager, whatever their role — so it shows nothing at all until
 * there is something to decide.
 */
export default function TeamRequests() {
  const queryClient = useQueryClient();
  const leave = useTeamLeave();
  const claims = useTeamClaims();
  const [error, setError] = useState<string | null>(null);

  const onDone = {
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals', 'team'] });
    },
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record that decision.',
      ),
  };
  const decideLeave = useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'approved' | 'rejected';
      remarks?: string;
    }) => decideTeamLeave(input.id, input.decision, input.remarks),
    ...onDone,
  });
  const decideClaim = useMutation({
    mutationFn: (input: {
      id: string;
      decision: 'approved' | 'rejected';
      remarks?: string;
    }) => decideTeamClaim(input.id, input.decision, input.remarks),
    ...onDone,
  });

  const leaveRows = leave.data ?? [];
  const claimRows = claims.data ?? [];
  if (leaveRows.length === 0 && claimRows.length === 0) return null;

  const reject = async (what: string) =>
    promptDialog({
      title: `Reject this ${what}?`,
      message: 'The employee will see your reason.',
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: 'Reject',
    });

  const leaveColumns: Column<TeamLeave>[] = [
    { key: 'employee', header: 'Employee', render: who },
    {
      key: 'leave',
      header: 'Leave',
      render: (row) => (
        <div>
          <div className="text-gray-900">
            {LEAVE_LABELS[row.leaveType] ?? row.leaveType} · {row.dayCount} day
            {row.dayCount === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-gray-500">
            {dateLabel(row.fromDate)} – {dateLabel(row.toDate)}
          </div>
        </div>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
  ];

  const claimColumns: Column<TeamClaim>[] = [
    { key: 'employee', header: 'Employee', render: who },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <div>
          <div className="text-gray-900">{money(row.amount)}</div>
          <div className="text-xs text-gray-500">
            {dateLabel(row.expenseDate)}
          </div>
        </div>
      ),
    },
    { key: 'description', header: 'For', render: (row) => row.description },
  ];

  return (
    <section aria-labelledby="approvals-team" className="space-y-3">
      <div>
        <h2
          id="approvals-team"
          className="text-base font-semibold text-gray-900"
        >
          Your team&apos;s requests
        </h2>
        <p className="text-sm text-gray-600">
          From the people who report to you. Approving sends a request on to HR
          for the final decision.
        </p>
      </div>
      <FormError message={error} />
      {leaveRows.length > 0 && (
        <ResponsiveList
          columns={leaveColumns}
          rows={leaveRows}
          rowKey={(row) => row.id}
          emptyMessage=""
          actions={(row) => (
            <>
              <RowAction
                disabled={decideLeave.isPending}
                onClick={() =>
                  decideLeave.mutate({ id: row.id, decision: 'approved' })
                }
              >
                Approve
              </RowAction>
              <RowAction
                disabled={decideLeave.isPending}
                onClick={async () => {
                  const remarks = await reject('leave');
                  if (remarks) {
                    decideLeave.mutate({
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
      {claimRows.length > 0 && (
        <ResponsiveList
          columns={claimColumns}
          rows={claimRows}
          rowKey={(row) => row.id}
          emptyMessage=""
          actions={(row) => (
            <>
              <RowAction
                disabled={decideClaim.isPending}
                onClick={() =>
                  decideClaim.mutate({ id: row.id, decision: 'approved' })
                }
              >
                Approve
              </RowAction>
              <RowAction
                disabled={decideClaim.isPending}
                onClick={async () => {
                  const remarks = await reject('claim');
                  if (remarks) {
                    decideClaim.mutate({
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

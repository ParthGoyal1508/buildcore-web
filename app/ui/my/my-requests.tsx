'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { getApprovalHistoryList } from '@/app/lib/api/approvals';
import {
  getLeaveApplications,
  getMyPunchExceptions,
  getReimbursementClaims,
} from '@/app/lib/api/my-workspace';
import { getCurrentUser } from '@/app/lib/api/users';
import { dateLabel, money } from '@/app/lib/format';
import { LEAVE_TYPE_LABEL } from '@/app/ui/my/leave-balance';
import { LoadingText } from '@/app/ui/spinner';

type Tone = 'waiting' | 'done' | 'refused' | 'closed';

interface RequestRow {
  key: string;
  kind: string;
  title: string;
  detail?: string;
  /** ISO date or timestamp the request was raised, for ordering. */
  raisedAt: string;
  status: string;
  /** Who it is with, while it is open. */
  where?: string;
  tone: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  waiting: 'bg-amber-100 text-amber-900',
  done: 'bg-green-100 text-green-800',
  refused: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-700',
};

/**
 * Everything the employee has asked for, and where each stands (2026-10-16, My Workspace).
 *
 * Leave, expense claims, flagged punches awaiting a correction decision, and anything they raised
 * through an approval chain, in one list, newest first — so "has my leave been approved yet?" is
 * one screen, not four. Read from the same endpoints the individual screens use; nothing here can
 * disagree with them.
 */
export default function MyRequests() {
  const me = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const leave = useQuery({
    queryKey: ['my', 'leave-applications'],
    queryFn: getLeaveApplications,
  });
  const claims = useQuery({
    queryKey: ['my', 'reimbursements'],
    queryFn: getReimbursementClaims,
  });
  const punches = useQuery({
    queryKey: ['my', 'punch-exceptions'],
    queryFn: getMyPunchExceptions,
  });
  const chain = useQuery({
    queryKey: ['my', 'requests', 'chain'],
    queryFn: () =>
      getApprovalHistoryList({ scope: 'mine', status: 'all', pageSize: 50 }),
  });

  const loading =
    leave.isPending || claims.isPending || punches.isPending || chain.isPending;
  if (loading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }

  const rows: RequestRow[] = [];

  for (const app of leave.data ?? []) {
    rows.push({
      key: `leave-${app.id}`,
      kind: 'Leave',
      title: `${LEAVE_TYPE_LABEL[app.leaveType] ?? app.leaveType} · ${app.dayCount} day${app.dayCount === 1 ? '' : 's'}`,
      detail: `${dateLabel(app.fromDate)} – ${dateLabel(app.toDate)}`,
      raisedAt: app.createdAt,
      status: app.status,
      where:
        app.status === 'pending' ? 'Awaiting approval' : undefined,
      tone:
        app.status === 'pending'
          ? 'waiting'
          : app.status === 'approved'
            ? 'done'
            : app.status === 'rejected'
              ? 'refused'
              : 'closed',
    });
  }

  for (const claim of claims.data ?? []) {
    if (claim.status === 'draft') continue;
    rows.push({
      key: `claim-${claim.id}`,
      kind: 'Expense claim',
      title: `${money(claim.amount)} · ${claim.description}`,
      detail: dateLabel(claim.expenseDate),
      raisedAt: claim.createdAt,
      status: claim.status,
      where:
        claim.status === 'submitted'
          ? 'Awaiting approval'
          : claim.status === 'approved'
            ? 'Approved — awaiting payment'
            : undefined,
      tone:
        claim.status === 'submitted' || claim.status === 'approved'
          ? 'waiting'
          : claim.status === 'paid'
            ? 'done'
            : claim.status === 'rejected'
              ? 'refused'
              : 'closed',
    });
  }

  for (const exception of punches.data ?? []) {
    const state = exception.approval?.state;
    if (!state) continue;
    rows.push({
      key: `punch-${exception.punch.id}`,
      kind: 'Attendance correction',
      title: `Punch ${exception.punch.type === 'in' ? 'in' : 'out'} on ${dateLabel(exception.punch.punchDate)}`,
      raisedAt: exception.punch.capturedAt,
      status: state,
      where:
        state === 'pending'
          ? `Level ${exception.approval?.currentPosition} of ${exception.approval?.totalLevels}`
          : undefined,
      tone:
        state === 'pending' || state === 'returned'
          ? 'waiting'
          : state === 'approved'
            ? 'done'
            : state === 'rejected'
              ? 'refused'
              : 'closed',
    });
  }

  // Chain items the employee raised (not ones they only decided), other than the flagged
  // punches already listed above.
  const listedPunch = new Set(
    (punches.data ?? []).map((p) => p.approval?.instanceId).filter(Boolean),
  );
  for (const entry of chain.data?.items ?? []) {
    if (entry.requestedById !== me.data?.id) continue;
    if (listedPunch.has(entry.instanceId)) continue;
    rows.push({
      key: `chain-${entry.instanceId}`,
      kind: entry.moduleLabel,
      title: entry.subject,
      raisedAt: entry.requestedAt,
      status: entry.state,
      where:
        entry.state === 'pending' && entry.awaitingLabel
          ? `With ${entry.awaitingLabel}`
          : undefined,
      tone:
        entry.state === 'pending' || entry.state === 'returned'
          ? 'waiting'
          : entry.state === 'approved'
            ? 'done'
            : entry.state === 'rejected'
              ? 'refused'
              : 'closed',
    });
  }

  rows.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
  const open = rows.filter((row) => row.tone === 'waiting').length;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        You have not raised any requests yet. Leave, expense claims and
        attendance corrections you submit will show here.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-600">
        {open === 0
          ? 'Nothing is waiting on anyone.'
          : `${open} request${open === 1 ? ' is' : 's are'} still being decided.`}
      </p>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {row.kind}
              </p>
              <p className="text-sm font-medium text-gray-900">{row.title}</p>
              {row.detail && (
                <p className="text-xs text-gray-500">{row.detail}</p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">
                Raised {dateLabel(row.raisedAt)}
              </p>
            </div>
            <div className="text-right">
              <span
                className={clsx(
                  'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  TONE_CLASS[row.tone],
                )}
              >
                {row.status}
              </span>
              {row.where && (
                <p className="mt-1 text-xs text-gray-500">{row.where}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

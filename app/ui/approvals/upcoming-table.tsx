'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import {
  getApprovalUpcoming,
  type ApprovalUpcomingEntry,
} from '@/app/lib/api/approvals';
import { dateTimeLabel } from '@/app/lib/format';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { LoadingText } from '@/app/ui/spinner';

/**
 * What will reach this user next (2026-10-15) — read-only.
 *
 * The client: "in the approval tab we are not seeing the payroll approvals". A payroll run is
 * decided by the site incharge, then HR, then the director; until the first two act it is not the
 * director's to decide, so it was rightly absent from "Waiting on you" — and with nothing else on
 * the page, absent altogether. Listed here with who it waits on, so the director can see it
 * coming and chase it, without being handed a control that the chain would refuse.
 *
 * Renders nothing when there is nothing coming, so the page does not grow an empty section.
 */
export default function ApprovalUpcoming() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['approvalUpcoming'],
    queryFn: getApprovalUpcoming,
    refetchOnWindowFocus: true,
  });

  if (isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load what is coming up.
      </p>
    );
  }
  if (data.length === 0) return null;

  const columns: Column<ApprovalUpcomingEntry>[] = [
    {
      key: 'subject',
      header: 'Item',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">
            {row.href ? (
              <Link
                href={row.href}
                className="text-brand-700 hover:text-brand-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {row.subject}
              </Link>
            ) : (
              row.subject
            )}
          </div>
          <div className="text-xs text-gray-500">{row.moduleLabel}</div>
        </div>
      ),
    },
    {
      key: 'waiting',
      header: 'Waiting on',
      render: (row) => (
        <div>
          <div className="text-gray-900">{row.levelLabel}</div>
          <div className="text-xs text-gray-500">
            Then you, as {row.yourLevelLabel}
          </div>
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      render: (row) => (
        <div>
          <div className="text-gray-900">{row.requestedByName}</div>
          <div className="text-xs text-gray-500">
            {dateTimeLabel(row.requestedAt)}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="approvals-upcoming" className="space-y-3">
      <div>
        <h2
          id="approvals-upcoming"
          className="text-base font-semibold text-gray-900"
        >
          Coming up
        </h2>
        <p className="text-sm text-gray-500">
          At an earlier step of their approval chain — they reach you once the
          step before you has decided.
        </p>
      </div>
      <ResponsiveList
        columns={columns}
        rows={data}
        rowKey={(row) => row.instanceId}
        emptyMessage="Nothing is on its way to you."
      />
    </section>
  );
}

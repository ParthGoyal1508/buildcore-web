'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  cancelIndent,
  getIndent,
  markProcurementNeeded,
  rejectIndent,
  type IndentLine,
} from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, inventoryLabel, overdueLabel } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import ApproveIndentModal from '@/app/ui/inventory/approve-indent-modal';
import IssueModal from '@/app/ui/inventory/issue-modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function IndentDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showApprove, setShowApprove] = useState(false);
  const [issueFor, setIssueFor] = useState<IndentLine | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canApprove = user?.permissions.includes('INVENTORY_APPROVE') ?? false;

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'indent', params.id],
    queryFn: () => getIndent(params.id),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const decide = useMutation({
    mutationFn: ({ action }: { action: 'reject' | 'cancel' }) =>
      action === 'reject'
        ? rejectIndent(params.id, reason.trim())
        : cancelIndent(params.id, reason.trim()),
    onSuccess: () => {
      setReason('');
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.status === 409
          ? MESSAGES.indentHasFulfilment
          : err instanceof ApiError
            ? err.message
            : 'Could not update this indent.',
      ),
  });

  const flag = useMutation({
    mutationFn: (lineIds: string[]) => markProcurementNeeded(params.id, lineIds),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not flag these lines.',
      ),
  });

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return <p className="p-4 text-sm text-red-600">{MESSAGES.inventoryLoadFailed}</p>;
  }

  const anyFulfilled = data.lines.some((line) => line.fulfilledQuantity > 0);

  const columns: Column<IndentLine>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900">{row.itemName}</span>
          <span className="block text-xs text-gray-500">{row.itemCode}</span>
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      render: (row) => `${row.requestedQuantity} ${row.unit}`,
    },
    {
      key: 'approved',
      header: 'Approved',
      render: (row) =>
        row.approvedQuantity === null ? (
          <span className="text-gray-500">Not yet decided</span>
        ) : (
          <span>
            {row.approvedQuantity} {row.unit}
            {row.reductionReason && (
              // The reason survives beside both figures — that is what makes a
              // reduction auditable rather than merely visible (009 FR-022).
              <span className="block text-xs text-gray-500">
                {row.reductionReason}
              </span>
            )}
          </span>
        ),
    },
    {
      key: 'fulfilled',
      header: 'Fulfilled',
      render: (row) => `${row.fulfilledQuantity} ${row.unit}`,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row) =>
        row.outstandingQuantity === null ? (
          '—'
        ) : (
          <span className="font-medium">
            {row.outstandingQuantity} {row.unit}
          </span>
        ),
    },
    {
      key: 'procurement',
      header: 'Needs buying',
      hideOnCard: true,
      render: (row) => (row.procurementPending ? 'Flagged' : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>
            {data.indentNumber}
          </h1>
          <p className="text-sm text-gray-600">
            {data.siteName} · required by {data.requiredByDate.slice(0, 10)}
          </p>
          {data.overdue && (
            <p className="text-sm font-medium text-red-700">
              {overdueLabel(data.overdueByDays)}
            </p>
          )}
        </div>
        <StatusBadge status={data.status} label={inventoryLabel(data.status)} />
      </div>

      <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {data.justification}
      </p>

      {data.decisionReason && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Decision: {data.decisionReason}
        </p>
      )}

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data.lines}
        rowKey={(row) => row.id}
        actions={(row) =>
          (data.status === 'approved' ||
            data.status === 'partially_fulfilled') &&
          (row.outstandingQuantity ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              <RowAction onClick={() => setIssueFor(row)}>
                Issue against this
              </RowAction>
              {canApprove && !row.procurementPending && (
                <RowAction onClick={() => flag.mutate([row.id])}>
                  Needs buying
                </RowAction>
              )}
            </div>
          ) : null
        }
      />

      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
        {MESSAGES.approvalDoesNotReserve}
      </p>

      {(data.status === 'submitted' || !anyFulfilled) && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
          <TextField
            id="indent-reason"
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="Required to reject or cancel an indent."
          />
          <div className="flex flex-wrap gap-2">
            {/* Approve and Reject are not rendered at all without the permission,
                rather than rendered and refused (009 TA010). */}
            {canApprove && data.status === 'submitted' && (
              <>
                <SecondaryButton
                  type="button"
                  onClick={() => setShowApprove(true)}
                >
                  Approve
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={!reason.trim() || decide.isPending}
                  onClick={() => decide.mutate({ action: 'reject' })}
                >
                  Reject
                </SecondaryButton>
              </>
            )}
            <SecondaryButton
              type="button"
              disabled={!reason.trim() || anyFulfilled || decide.isPending}
              title={anyFulfilled ? MESSAGES.indentHasFulfilment : undefined}
              onClick={() => decide.mutate({ action: 'cancel' })}
            >
              Cancel indent
            </SecondaryButton>
          </div>
        </div>
      )}

      {showApprove && (
        <ApproveIndentModal
          indent={data}
          onClose={() => setShowApprove(false)}
        />
      )}

      {issueFor && (
        <IssueModal
          onClose={() => setIssueFor(null)}
          indentLineId={issueFor.id}
          outstandingQuantity={issueFor.outstandingQuantity ?? undefined}
          defaults={{ siteId: data.siteId, itemId: issueFor.itemId }}
        />
      )}
    </div>
  );
}

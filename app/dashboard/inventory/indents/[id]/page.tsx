'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import {
  cancelIndent,
  getIndent,
  downloadStoreDocument,
  markProcurementNeeded,
  rejectIndent,
  type IndentLine,
} from '@/app/lib/api/inventory';
import { getCurrentUser } from '@/app/lib/api/users';
import { MESSAGES, inventoryLabel, overdueLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { promptDialog } from '@/app/ui/dialogs';
import ApproveIndentModal from '@/app/ui/inventory/approve-indent-modal';
import IssueModal from '@/app/ui/inventory/issue-modal';
import StoreDocumentDownload from '@/app/ui/inventory/store-document-download';
import QueryError from '@/app/ui/query-error';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';
import { LoadingText } from '@/app/ui/spinner';
import { useToast } from '@/app/ui/toast';
import { dateLabel, quantity as formatQuantity } from '@/app/lib/format';

/** The server's `@MaxLength` on a rejection or cancellation reason. */
const REASON_MAX = 500;

/** Statuses the server will cancel from — it refuses rejected and cancelled indents, and any
 * indent with material already issued against it (which a fulfilled one always has). */
const CANCELLABLE = new Set(['draft', 'submitted', 'approved']);

/**
 * 036 M8 (2026-10-17):
 * - "Cancel indent" is offered only where the server would accept it: rejected, cancelled and
 *   fulfilled indents used to show it, and it failed on press.
 * - Reject and Cancel ask for their reason in a confirmation dialog — one tap on either used to
 *   act at once, with the reason in a loose text box shared by both.
 * - Approve is hidden from whoever raised the indent: the server refuses self-approval.
 * - A load failure offers Retry.
 */
export default function IndentDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showApprove, setShowApprove] = useState(false);
  const [issueFor, setIssueFor] = useState<IndentLine | null>(null);
  const toast = useToast();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canApprove = user?.permissions.includes('INVENTORY_APPROVE') ?? false;

  const { data, isPending, error: loadError, refetch } = useQuery({
    queryKey: ['inventory', 'indent', params.id],
    queryFn: () => getIndent(params.id),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const decide = useMutation({
    mutationFn: ({
      action,
      reason,
    }: {
      action: 'reject' | 'cancel';
      reason: string;
    }) =>
      action === 'reject'
        ? rejectIndent(params.id, reason)
        : cancelIndent(params.id, reason),
    onSuccess: (_, { action }) => {
      toast.success(action === 'reject' ? 'Indent rejected' : 'Indent cancelled');
      invalidate();
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.status === 409
          ? errorMessage(err, MESSAGES.indentHasFulfilment)
          : errorMessage(err, 'Could not update this indent.'),
      ),
  });

  const flag = useMutation({
    mutationFn: (lineIds: string[]) =>
      markProcurementNeeded(params.id, lineIds),
    onSuccess: () => {
      toast.success('Flagged as needing to be bought');
      invalidate();
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not flag these lines.')),
  });

  if (isPending) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <QueryError
        error={loadError}
        onRetry={refetch}
        fallback={MESSAGES.inventoryLoadFailed}
      />
    );
  }

  const anyFulfilled = data.lines.some((line) => line.fulfilledQuantity > 0);
  const cancellable = CANCELLABLE.has(data.status) && !anyFulfilled;
  const isRequester = user?.id === data.requestedByUserId;
  const decidable = canApprove && data.status === 'submitted';

  const askAndDecide = async (action: 'reject' | 'cancel') => {
    const reason = await promptDialog({
      title: action === 'reject' ? 'Reject this indent?' : 'Cancel this indent?',
      message:
        action === 'reject'
          ? `${data.indentNumber} goes back to the requester as rejected. They see the reason you give.`
          : `${data.indentNumber} is withdrawn and nothing more can be issued against it.`,
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: action === 'reject' ? 'Reject indent' : 'Cancel indent',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    const trimmed = reason?.trim();
    if (!trimmed) return;
    if (trimmed.length > REASON_MAX) {
      toast.error(`Keep the reason to ${REASON_MAX} characters.`);
      return;
    }
    decide.mutate({ action, reason: trimmed });
  };

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
      render: (row) => `${formatQuantity(row.requestedQuantity)} ${row.unit}`,
    },
    {
      key: 'approved',
      header: 'Approved',
      render: (row) =>
        row.approvedQuantity === null ? (
          <span className="text-gray-500">Not yet decided</span>
        ) : (
          <span>
            {formatQuantity(row.approvedQuantity)} {row.unit}
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
      render: (row) => `${formatQuantity(row.fulfilledQuantity)} ${row.unit}`,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row) =>
        row.outstandingQuantity === null ? (
          '—'
        ) : (
          <span className="font-medium">
            {formatQuantity(row.outstandingQuantity)} {row.unit}
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
          <PageHeader title={data.indentNumber} />
          <p className="text-sm text-gray-600">
            {data.siteName}
            {data.department ? ` · ${data.department}` : ''} · required by{' '}
            {dateLabel(data.requiredByDate)}
          </p>
          {data.overdue && (
            <p className="text-sm font-medium text-red-700">
              {overdueLabel(data.overdueByDays)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The client's Material Indent document (2026-10-15). */}
          <StoreDocumentDownload
            label="Download indent"
            fallbackName={`Indent ${data.indentNumber.replace(/\//g, '-')}`}
            load={(format) => downloadStoreDocument('indent', data.id, format)}
            onError={(message) => toast.error(message)}
          />
          <StatusBadge
            status={data.status}
            label={inventoryLabel(data.status)}
          />
        </div>
      </div>

      <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {data.justification}
      </p>

      {data.decisionReason && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Decision: {data.decisionReason}
        </p>
      )}

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
                <RowAction
                  onClick={() => flag.mutate([row.id])}
                  loading={flag.isPending && flag.variables?.[0] === row.id}
                >
                  Needs buying
                </RowAction>
              )}
            </div>
          ) : null
        }
      />

      <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
        {MESSAGES.approvalDoesNotReserve}
      </p>

      {(decidable || cancellable) && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
          {decidable && isRequester && (
            <p className="text-sm text-gray-600">
              You raised this indent, so someone else must approve or reject it.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {/* Approve and Reject are not rendered at all without the permission,
                rather than rendered and refused (009 TA010) — nor for the requester (036 M8). */}
            {decidable && !isRequester && (
              <>
                <Button type="button" onClick={() => setShowApprove(true)}>
                  Approve
                </Button>
                <SecondaryButton
                  type="button"
                  loading={decide.isPending && decide.variables?.action === 'reject'}
                  disabled={decide.isPending}
                  onClick={() => void askAndDecide('reject')}
                >
                  Reject
                </SecondaryButton>
              </>
            )}
            {cancellable && (
              <SecondaryButton
                type="button"
                loading={decide.isPending && decide.variables?.action === 'cancel'}
                disabled={decide.isPending}
                onClick={() => void askAndDecide('cancel')}
              >
                Cancel indent
              </SecondaryButton>
            )}
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
          defaultLabels={{
            siteName: data.siteName,
            itemName: issueFor.itemName,
            itemCode: issueFor.itemCode,
          }}
        />
      )}
    </div>
  );
}

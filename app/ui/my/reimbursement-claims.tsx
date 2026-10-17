'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import { errorMessage } from '@/app/lib/api/client';
import {
  deleteReimbursementClaim,
  getReimbursementCategories,
  getReimbursementClaims,
  updateReimbursementClaim,
  withdrawReimbursementClaim,
  requestStage,
  type ReimbursementClaim,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import ReimbursementForm, {
  useViewReceipt,
} from '@/app/ui/my/reimbursement-form';
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';
import { dateLabel, rupees } from '@/app/lib/format';

/** Distinct per status (US8 AC4). Rejected is the one in red: it is the only
 * outcome that costs the employee money they have already spent. */
const STATUS_CLASS: Record<ReimbursementClaim['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paid: 'bg-blue-100 text-blue-800',
  withdrawn: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<ReimbursementClaim['status'], string> = {
  draft: 'Draft',
  submitted: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  withdrawn: 'Withdrawn',
};

const PAYMENT_LABEL: Record<'payroll' | 'direct', string> = {
  payroll: 'via payroll',
  direct: 'paid directly',
};

const shortDate = (value: string) => dateLabel(value.slice(0, 10));

export default function ReimbursementClaims() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { viewReceipt, viewing } = useViewReceipt();
  const [isFiling, setIsFiling] = useState(false);
  const [editing, setEditing] = useState<ReimbursementClaim | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my', 'reimbursements'],
    queryFn: getReimbursementClaims,
  });

  // Claims carry a categoryId, not a name; the categories are already fetched for
  // the form, so this reuses that cache rather than adding a second request.
  const { data: categories } = useQuery({
    queryKey: ['my', 'reimbursement-categories'],
    queryFn: getReimbursementCategories,
  });
  const categoryName = (id: string) =>
    categories?.find((c) => c.id === id)?.name ?? '—';

  // 036 G5: toasts in place of a banner above the list, which stayed after the next success.
  const afterChange = (message: string) => () => {
    queryClient.invalidateQueries({ queryKey: ['my', 'reimbursements'] });
    toast.success(message);
  };
  const onError = (err: unknown) =>
    toast.error(errorMessage(err, MESSAGES.saveFailed));

  const withdraw = useMutation({
    mutationFn: withdrawReimbursementClaim,
    onSuccess: afterChange('Claim withdrawn'),
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteReimbursementClaim,
    onSuccess: afterChange('Draft deleted'),
    onError,
  });
  // A status-only edit: the backend re-checks the receipt threshold against the
  // claim's final values (FR-030), so a draft saved under the limit and then
  // submitted over it is still refused here rather than slipping into review.
  const submit = useMutation({
    mutationFn: (id: string) =>
      updateReimbursementClaim(id, { status: 'submitted' }),
    onSuccess: afterChange('Claim submitted'),
    onError,
  });

  const columns: Column<ReimbursementClaim>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap">{shortDate(row.expenseDate)}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => categoryName(row.categoryId),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {rupees(row.amount)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description,
      hideOnCard: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <span
            className={clsx(
              'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_CLASS[row.status],
            )}
          >
            {STATUS_LABEL[row.status]}
          </span>
          {/* Where a submitted claim is (2026-10-16): the reporting manager decides first. */}
          {row.status === 'submitted' && (
            <p className="mt-1 text-xs text-gray-500">
              {requestStage(row) === 'manager'
                ? 'With your reporting manager'
                : 'With HR'}
            </p>
          )}
          {row.status === 'rejected' && row.adminRemarks && (
            <p className="mt-1 text-xs text-gray-500">{row.adminRemarks}</p>
          )}
          {/* How it was settled only exists once it has been (US8 AC4). */}
          {row.status === 'paid' && row.paymentMode && (
            <p className="mt-1 text-xs text-gray-500">
              {PAYMENT_LABEL[row.paymentMode]}
            </p>
          )}
          {/* 036 G5: openable — the employee could see a receipt was attached but not which. */}
          {row.receiptRef && (
            <RowAction
              type="button"
              intent="read"
              className="mt-1"
              loading={viewing === row.id}
              onClick={() => void viewReceipt(row.id)}
            >
              View receipt
            </RowAction>
          )}
        </div>
      ),
    },
  ];

  if (isFiling || editing) {
    return (
      <ReimbursementForm
        editing={editing ?? undefined}
        onDone={() => {
          setIsFiling(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <section className="space-y-4">
      <Button type="button" onClick={() => setIsFiling(true)}>
        New claim
      </Button>


      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        skeletonRows={3}
        emptyMessage="You have not filed any reimbursement claims yet."
        actions={(row) => {
          // A draft is still the employee's to change or discard; a submitted
          // claim can only be pulled back out of review; anything decided is
          // read-only (US8 AC3). Rendering disabled controls on a decided claim
          // would imply it might become editable again.
          if (row.status === 'draft') {
            return (
              <div className="flex gap-2">
                <RowAction type="button" onClick={() => setEditing(row)}>
                  Edit
                </RowAction>
                {/* Not confirmed, unlike Delete: submitting is reversible with
                    Withdraw while the claim is still pending review. */}
                <RowAction
                  type="button"
                  className="text-blue-600"
                  disabled={submit.isPending}
                  loading={submit.isPending && submit.variables === row.id}
                  onClick={() => submit.mutate(row.id)}
                >
                  Submit
                </RowAction>
                <RowAction
                  type="button"
                  className="text-red-600"
                  disabled={remove.isPending}
                  loading={remove.isPending && remove.variables === row.id}
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: 'Delete this claim?',
                        message: MESSAGES.confirmDeleteClaim,
                        confirmLabel: 'Delete',
                        tone: 'danger',
                      })
                    ) {
                      remove.mutate(row.id);
                    }
                  }}
                >
                  Delete
                </RowAction>
              </div>
            );
          }
          if (row.status === 'submitted') {
            return (
              <RowAction
                type="button"
                className="text-red-600"
                disabled={withdraw.isPending}
                loading={withdraw.isPending && withdraw.variables === row.id}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Withdraw this claim?',
                      message: MESSAGES.confirmWithdrawClaim,
                      confirmLabel: 'Withdraw',
                      tone: 'danger',
                    })
                  ) {
                    withdraw.mutate(row.id);
                  }
                }}
              >
                Withdraw
              </RowAction>
            );
          }
          return null;
        }}
      />
    </section>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  approveClaim,
  listAdminClaims,
  payClaim,
  rejectClaim,
  type AdminClaim,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, MESSAGES, hrLabel } from '@/app/lib/constants';
import { dateLabel, money } from '@/app/lib/format';
import { getReimbursementCategories } from '@/app/lib/api/my-workspace';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import { Button } from '@/app/ui/button';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

const STATUSES = ['submitted', 'approved', 'rejected', 'paid'] as const;

/**
 * Admin review of reimbursement claims (005 US12).
 *
 * Three distinct actions rather than a single status dropdown, because they are
 * three different decisions: approving accepts the claim, rejecting needs a reason
 * the employee will read, and paying records that money actually moved. Collapsing
 * them into one control makes "paid" reachable from "submitted" without anyone
 * having approved it.
 */
/**
 * Asks how a claim was paid.
 *
 * `paymentMode` is required by the backend and there is no safe default:
 * `payroll` adds the amount to the employee's next run, while `direct` settles
 * it outside payroll. Defaulting to either one silently pays the claim twice or
 * not at all, so the choice is put to whoever is recording it. A direct payment
 * additionally wants the transfer reference, which is the only record that the
 * money actually moved.
 */
function PayClaimModal({
  claim,
  employeeLabel,
  onClose,
}: {
  claim: AdminClaim;
  employeeLabel: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [paymentMode, setPaymentMode] = useState<'payroll' | 'direct'>('payroll');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsReference = paymentMode === 'direct';
  const canSubmit = !needsReference || paymentReference.trim().length > 0;

  const pay = useMutation({
    mutationFn: () =>
      payClaim(claim.id, {
        paymentMode,
        paymentReference: paymentReference.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'claims'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => pay.mutate()}
            disabled={!canSubmit || pay.isPending}
          >
            {pay.isPending ? 'Saving…' : 'Mark paid'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          {employeeLabel} · {money(claim.amount)}
        </p>
        <SelectField
          id="pay-mode"
          label="Payment mode"
          value={paymentMode}
          onChange={(event) =>
            setPaymentMode(event.target.value as 'payroll' | 'direct')
          }
        >
          <option value="payroll">Through payroll — added to the next run</option>
          <option value="direct">Direct — settled outside payroll</option>
        </SelectField>
        {needsReference && (
          <TextField
            id="pay-reference"
            label="Transfer reference"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            hint="The only record that this money actually moved."
          />
        )}
      </div>
    </Modal>
  );
}

export default function ReimbursementsAdminTable() {
  const queryClient = useQueryClient();
  const employees = useEmployeeNames();
  // The claim carries only `categoryId`; the category master supplies the name.
  const { data: categories } = useQuery({
    queryKey: ['reimbursementCategories'],
    queryFn: getReimbursementCategories,
  });
  const categoryName = (id: string | null | undefined) =>
    (id && categories?.find((c) => c.id === id)?.name) || '—';
  const [status, setStatus] = useState<string>('submitted');
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<AdminClaim | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'claims', status],
    queryFn: () => listAdminClaims(status ? { status } : {}),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['hr', 'claims'] });

  const approve = useMutation({
    mutationFn: (id: string) => approveClaim(id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      rejectClaim(id, remarks),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<AdminClaim>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => categoryName(row.categoryId),
    },
    { key: 'amount', header: 'Amount', numeric: true, render: (row) => money(row.amount) },
    {
      key: 'date',
      header: 'Expense date',
      render: (row) => dateLabel(row.expenseDate),
    },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (row) =>
        row.receiptRef ? (
          'Attached'
        ) : (
          <span className="text-amber-700">None</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => row.adminRemarks ?? '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <SelectField
          id="claim-status"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {hrLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <FormError message={error} />

      <DataTable
        caption="Reimbursement claims"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No claims match this filter."
        actions={(row) => (
          <>
            {row.status === 'submitted' && (
              <>
                <RowAction type="button" onClick={() => approve.mutate(row.id)}>
                  Approve
                </RowAction>
                <RowAction
                  type="button"
                  onClick={() => {
                    const remarks = window.prompt(HR_MESSAGES.rejectNeedsRemarks);
                    if (remarks?.trim()) {
                      reject.mutate({ id: row.id, remarks: remarks.trim() });
                    }
                  }}
                >
                  Reject
                </RowAction>
              </>
            )}
            {row.status === 'approved' && (
              <RowAction type="button" onClick={() => setPaying(row)}>
                Mark paid
              </RowAction>
            )}
            {!['submitted', 'approved'].includes(row.status) && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </>
        )}
      />

      {paying && (
        <PayClaimModal
          claim={paying}
          employeeLabel={employees.label(paying.employeeId)}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

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
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { FormError, RowAction, SelectField } from '@/app/ui/settings/form-fields';

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
export default function ReimbursementsAdminTable() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('submitted');
  const [error, setError] = useState<string | null>(null);

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

  const pay = useMutation({
    mutationFn: (id: string) => payClaim(id),
    onSuccess: invalidate,
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<AdminClaim>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.employeeName ?? row.employeeCode ?? row.employeeId,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => row.category ?? '—',
    },
    { key: 'amount', header: 'Amount', numeric: true, render: (row) => money(row.amount) },
    { key: 'date', header: 'Claim date', render: (row) => dateLabel(row.claimDate) },
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
    { key: 'remarks', header: 'Remarks', render: (row) => row.remarks ?? '—' },
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
              <RowAction type="button" onClick={() => pay.mutate(row.id)}>
                Mark paid
              </RowAction>
            )}
            {!['submitted', 'approved'].includes(row.status) && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </>
        )}
      />
    </div>
  );
}

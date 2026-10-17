'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  approveClaim,
  getClaimReceipt,
  listAdminClaimsPage,
  listReimbursementCategories,
  payClaim,
  rejectClaim,
  type AdminClaim,
} from '@/app/lib/api/hr-payroll';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { HR_MESSAGES, hrLabel } from '@/app/lib/constants';
import { dateLabel, money, periodLabel, rupees } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { downloadCsv } from '@/app/ui/hr/csv';
import { useApproverSelf } from '@/app/ui/hr/use-approver-self';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { useToast } from '@/app/ui/toast';
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
import { confirmDialog, promptDialog } from '@/app/ui/dialogs';


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
  const toast = useToast();
  const [paymentMode, setPaymentMode] = useState<'payroll' | 'direct'>(
    'payroll',
  );
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
      toast.success('Payment recorded.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'claims'] });
      onClose();
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not record the payment.')),
  });

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      pending={pay.isPending}
      isDirty={paymentReference.trim().length > 0}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => pay.mutate()}
            disabled={!canSubmit}
            loading={pay.isPending}
          >
            Mark paid
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
          <option value="payroll">
            Through payroll — added to the next run
          </option>
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

const STATUS_FILTERS = ['submitted', 'approved', 'rejected', 'paid', 'all'] as const;
const PAGE_SIZE = 25;

/** `YYYY-MM` → the first and last day of that month. */
function monthRange(month: string): { from?: string; to?: string } {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return {};
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

/**
 * 036 F17/F18: the approver can open the receipt and read the description; Approve asks first,
 * naming who and how much, and every action locks while it runs; the queue pages on the server
 * (it showed the first 25 only), filters by expense month, keeps its filters in the URL, and
 * exports CSV. Approve, Reject and Mark paid need PAYROLL write — the server's rule since 036 —
 * so a reader with EMPLOYEES only sees the queue without them.
 */
export default function ReimbursementsAdminTable() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const self = useApproverSelf();
  const { view, viewer } = useFileViewer();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const canDecide = hasWrite(user, 'PAYROLL');
  // The claim carries only `categoryId`; the category master supplies the name.
  const { data: categories } = useQuery({
    queryKey: ['settings', 'reimbursementCategories'],
    queryFn: listReimbursementCategories,
  });
  const categoryName = (id: string | null | undefined) =>
    (id && categories?.find((c) => c.id === id)?.name) || '—';
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<AdminClaim | null>(null);
  const [filters, setFilters] = useUrlState(
    {
      status: urlEnum(STATUS_FILTERS, 'submitted'),
      month: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );

  const query = {
    ...(filters.status === 'all' ? {} : { status: filters.status }),
    ...monthRange(filters.month),
  };
  const claims = useQuery({
    queryKey: ['hr', 'claims', query, filters.page],
    queryFn: () =>
      listAdminClaimsPage({ ...query, page: filters.page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = claims.data?.items ?? [];
  const total = claims.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const employees = useEmployeeNames(rows.map((row) => row.employeeId));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['hr', 'claims'] });

  const approve = useMutation({
    mutationFn: (id: string) => approveClaim(id),
    onSuccess: () => {
      setError(null);
      toast.success('Claim approved.');
      void invalidate();
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not approve the claim.')),
  });

  const reject = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      rejectClaim(id, remarks),
    onSuccess: () => {
      setError(null);
      toast.success('Claim rejected.');
      void invalidate();
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not reject the claim.')),
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const all: AdminClaim[] = [];
      for (let page = 1; ; page += 1) {
        const batch = await listAdminClaimsPage({ ...query, page, pageSize: 100 });
        all.push(...batch.items);
        if (all.length >= batch.total || batch.items.length === 0) break;
      }
      return all;
    },
    onSuccess: (all) =>
      downloadCsv(
        `Reimbursements_${filters.month || 'all'}_${filters.status}.csv`,
        ['Employee', 'Category', 'Description', 'Amount', 'Expense date', 'Receipt', 'Status', 'Remarks'],
        all.map((row) => [
          employees.label(row.employeeId),
          categoryName(row.categoryId),
          row.description ?? '',
          row.amount.toFixed(2),
          row.expenseDate ? dateLabel(row.expenseDate) : '',
          row.receiptRef ? 'Yes' : 'No',
          hrLabel(row.status),
          row.adminRemarks ?? '',
        ]),
      ),
    onError: (err) => toast.error(errorMessage(err, 'Could not export the claims.')),
  });

  const busy = approve.isPending || reject.isPending;
  const isOwn = (row: AdminClaim) =>
    self.isSelf({ employeeCode: employees.code(row.employeeId) });

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
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="block max-w-[18rem] whitespace-normal text-gray-700">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      render: (row) => money(row.amount),
    },
    {
      key: 'date',
      header: 'Expense date',
      render: (row) => dateLabel(row.expenseDate),
    },
    {
      key: 'receipt',
      header: 'Receipt',
      sortable: false,
      render: (row) =>
        row.receiptRef ? (
          <RowAction
            intent="read"
            type="button"
            onClick={() =>
              void view({
                title: `Receipt · ${employees.label(row.employeeId)} · ${rupees(row.amount)}`,
                fileName: `receipt-${row.id}`,
                load: () => getClaimReceipt(row.id),
              })
            }
          >
            View
          </RowAction>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
          <SelectField
            id="claim-status"
            label="Status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ status: event.target.value as (typeof STATUS_FILTERS)[number] })
            }
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All statuses' : hrLabel(value)}
              </option>
            ))}
          </SelectField>
          <TextField
            id="claim-month"
            label="Expense month"
            type="month"
            value={filters.month}
            onChange={(event) => setFilters({ month: event.target.value })}
            hint={filters.month ? periodLabel(filters.month) : 'All months'}
          />
        </div>
        <SecondaryButton
          type="button"
          loading={exportCsv.isPending}
          disabled={total === 0}
          onClick={() => exportCsv.mutate()}
        >
          Export CSV
        </SecondaryButton>
      </div>

      <FormError message={error} />

      <DataTable
        caption="Reimbursement claims"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={claims.isPending}
        error={claims.isError ? claims.error : null}
        onRetry={() => claims.refetch()}
        serverPaged
        isRefreshing={claims.isPlaceholderData}
        emptyMessage="No claims match this filter."
        actions={(row) => {
          if (!canDecide || !['submitted', 'approved'].includes(row.status)) {
            return <span className="text-xs text-gray-400">—</span>;
          }
          if (isOwn(row)) {
            return (
              <span className="text-xs text-gray-500">Another approver must decide</span>
            );
          }
          return row.status === 'submitted' ? (
            <>
              <RowAction
                type="button"
                loading={approve.isPending && approve.variables === row.id}
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Approve this claim?',
                      message: `${rupees(row.amount)} to ${employees.label(
                        row.employeeId,
                      )} for ${categoryName(row.categoryId)}${
                        row.receiptRef ? '' : ' — no receipt attached'
                      }.`,
                      confirmLabel: 'Approve',
                      tone: 'default',
                    })
                  ) {
                    approve.mutate(row.id);
                  }
                }}
              >
                Approve
              </RowAction>
              <RowAction
                type="button"
                loading={reject.isPending && reject.variables?.id === row.id}
                disabled={busy}
                onClick={async () => {
                  const remarks = await promptDialog({
                    title: 'Reject this claim?',
                    message: HR_MESSAGES.rejectNeedsRemarks,
                    required: true,
                    multiline: true,
                    confirmLabel: 'Reject',
                    tone: 'danger',
                  });
                  if (remarks?.trim()) {
                    reject.mutate({ id: row.id, remarks: remarks.trim() });
                  }
                }}
              >
                Reject
              </RowAction>
            </>
          ) : (
            <RowAction type="button" onClick={() => setPaying(row)}>
              Mark paid
            </RowAction>
          );
        }}
      />

      {total > PAGE_SIZE && (
        <nav
          className="flex items-center justify-between text-sm"
          aria-label="Claim pages"
        >
          <p className="text-gray-600">
            Page {filters.page} of {lastPage} · {total} claims
          </p>
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              disabled={filters.page === 1}
              onClick={() => setFilters({ page: Math.max(1, filters.page - 1) })}
            >
              Previous
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={filters.page >= lastPage}
              onClick={() => setFilters({ page: Math.min(lastPage, filters.page + 1) })}
            >
              Next
            </SecondaryButton>
          </div>
        </nav>
      )}

      {paying && (
        <PayClaimModal
          claim={paying}
          employeeLabel={employees.label(paying.employeeId)}
          onClose={() => setPaying(null)}
        />
      )}
      {viewer}
    </div>
  );
}

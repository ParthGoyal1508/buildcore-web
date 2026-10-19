'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { amountOrHidden } from '@/app/lib/api/cash-hiding';
import HiddenAmount from '@/app/ui/hidden-amount';
import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  deletePayment,
  downloadInventoryExport,
  getPayments,
  type Payment,
} from '@/app/lib/api/inventory';
import {
  DOCUMENT_COPY,
  MESSAGES,
  PAYMENT_MODES,
  inventoryLabel,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import {
  dateRangeError,
  searchVendors,
  useVendorOption,
} from '@/app/ui/inventory/inventory-search';
import PaymentModal from '@/app/ui/inventory/payment-modal';
import PaymentProofCell from '@/app/ui/inventory/payment-proof-cell';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Pager from '@/app/ui/inventory/pager';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import PageHeader from '@/app/ui/page-header';
import { confirmDialog } from '@/app/ui/dialogs';

/**
 * Vendor payments (009), on the 036 kit (M5, M10, M12): filters in the URL, the vendor searched on
 * the server, dates as DD-MM-YYYY, the whole filter's total and an Excel download of it, Record
 * payment as the primary action, and a per-row pending Delete.
 */
function PaymentsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  /**
   * `proof` is FR-021 as a **filter**, not a count: "14 payments lack proof" makes somebody scroll
   * a list looking for them; a filter hands them the fourteen. `''` is all payments.
   */
  const [filters, setFilters, query] = useUrlState(
    {
      vendorId: urlString(),
      paymentMode: urlEnum(['', ...PAYMENT_MODES] as const, ''),
      proof: urlEnum(['', 'missing', 'present'] as const, ''),
      from: urlString(),
      to: urlString(),
      page: urlNumber(1),
    },
    { resetPage: 'page' },
  );
  const vendorOption = useVendorOption(filters.vendorId);
  const rangeError = dateRangeError(filters.from, filters.to);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = {
    page: query.page,
    vendorId: query.vendorId || undefined,
    paymentMode: query.paymentMode || undefined,
    dateFrom: query.from || undefined,
    dateTo: query.to || undefined,
    missingProof:
      query.proof === 'missing'
        ? true
        : query.proof === 'present'
          ? false
          : undefined,
  };

  const list = useQuery({
    queryKey: ['inventory', 'payments', companyId, params],
    queryFn: () => getPayments(params),
    placeholderData: keepPreviousData,
    enabled: !rangeError,
  });
  const data = list.data;

  const remove = useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      setError(null);
      toast.success('Payment deleted; its bills are unpaid again');
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not delete this payment.')),
  });

  async function exportXlsx() {
    setExporting(true);
    try {
      saveBlob(
        await downloadInventoryExport('payments', { ...params, page: undefined }),
        `vendor-payments-${todayIso()}.xlsx`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the payments.'));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', render: (row) => dateLabel(row.date) },
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendorName },
    {
      key: 'amount',
      header: 'Amount',
      // "Hidden", not an em dash: an em dash is what this table shows for a figure that was
      // never recorded, and a reader cannot be left unable to tell the two apart. The component
      // rather than the string, so the cell carries the explanation on hover.
      render: (row) =>
        row.amount === null && row.amountHidden ? (
          <HiddenAmount />
        ) : (
          amountOrHidden(row.amount, row.amountHidden, rupees)
        ),
    },
    {
      key: 'mode',
      header: 'Mode',
      render: (row) => inventoryLabel(row.paymentMode),
    },
    {
      key: 'reference',
      header: 'Reference',
      hideOnCard: true,
      render: (row) => row.referenceNumber,
    },
    {
      key: 'bills',
      header: 'Bills settled',
      render: (row) => row.allocatedBillCount,
    },
    {
      key: 'proof',
      header: 'Proof',
      // 017 FR-020. The evidence behind the reference number, which until now was a number
      // somebody typed and nothing else.
      render: (row) => <PaymentProofCell payment={row} />,
    },
    {
      key: 'unallocated',
      header: 'Unallocated',
      render: (row) =>
        row.unallocatedBalance > 0 ? (
          // Worth calling out: this is money paid that no bill has claimed yet.
          <span className="font-medium text-amber-800">
            {rupees(row.unallocatedBalance)}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Payments" />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            onClick={() => void exportXlsx()}
            disabled={exporting || Boolean(rangeError)}
          >
            {exporting ? 'Preparing…' : 'Export to Excel'}
          </SecondaryButton>
          <Button type="button" onClick={() => setShowModal(true)}>
            Record payment
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="payments-vendor" className="font-medium text-gray-700">
            Vendor
          </label>
          <AsyncSelect
            id="payments-vendor"
            value={filters.vendorId}
            onChange={(id) => setFilters({ vendorId: id })}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={vendorOption}
            emptyLabel="All vendors"
            placeholder="All vendors"
          />
        </div>

        <SelectField
          id="payments-mode"
          label="Mode"
          value={filters.paymentMode}
          onChange={(event) =>
            setFilters({
              paymentMode: event.target.value as (typeof filters)['paymentMode'],
            })
          }
        >
          <option value="">Any mode</option>
          {PAYMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {inventoryLabel(mode)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="payments-proof"
          label={DOCUMENT_COPY.proofFilterLabel}
          value={filters.proof}
          onChange={(event) =>
            setFilters({
              proof: event.target.value as '' | 'missing' | 'present',
            })
          }
        >
          <option value="">{DOCUMENT_COPY.proofFilterAll}</option>
          <option value="missing">{DOCUMENT_COPY.proofFilterMissing}</option>
          <option value="present">{DOCUMENT_COPY.proofFilterPresent}</option>
        </SelectField>

        <TextField
          id="payments-from"
          label="From"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilters({ from: event.target.value })}
        />
        <TextField
          id="payments-to"
          label="To"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => setFilters({ to: event.target.value })}
          error={rangeError}
        />
      </div>

      <FormError message={error} />

      {/* Said once, because a list that silently excludes rows is one somebody reads as the
          whole set. */}
      {filters.proof === 'missing' && (
        <p className="text-sm text-amber-800">
          {DOCUMENT_COPY.proofFilterActive}
        </p>
      )}

      {data?.totals && data.total > 0 && (
        <p className="text-sm text-gray-700">
          {data.total} payment{data.total === 1 ? '' : 's'} ·{' '}
          <span className="font-medium">{rupees(data.totals.amount)}</span>{' '}
          paid · {rupees(data.totals.allocatedAmount)} settled against bills
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={data?.payments ?? []}
        rowKey={(row) => row.id}
        isLoading={list.isPending && !rangeError}
        isRefreshing={list.isFetching && !list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        serverPaged
        emptyMessage={MESSAGES.paymentsEmpty}
        actions={(row) => (
          <RowAction
            onClick={async () => {
              if (
                await confirmDialog({
                  title: 'Delete this payment?',
                  message: MESSAGES.confirmDeletePayment,
                  confirmLabel: 'Delete',
                  tone: 'danger',
                })
              ) {
                remove.mutate(row.id);
              }
            }}
            loading={remove.isPending && remove.variables === row.id}
            disabled={remove.isPending}
          >
            Delete
          </RowAction>
        )}
      />

      <Pager
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 25}
        onPageChange={(page) => setFilters({ page })}
        noun="payment"
      />

      {showModal && <PaymentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

export default function PaymentsPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Date', 'Vendor', 'Amount', 'Mode', 'Proof']}
          rows={8}
        />
      }
    >
      <PaymentsList />
    </Suspense>
  );
}

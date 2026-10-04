'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { amountOrHidden } from '@/app/lib/api/cash-hiding';
import HiddenAmount from '@/app/ui/hidden-amount';
import { ApiError } from '@/app/lib/api/client';
import { deletePayment, getPayments, type Payment } from '@/app/lib/api/inventory';
import {
  DOCUMENT_COPY,
  MESSAGES,
  PAYMENT_MODES,
  inventoryLabel,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import PaymentModal from '@/app/ui/inventory/payment-modal';
import PaymentProofCell from '@/app/ui/inventory/payment-proof-cell';
import { useVendors } from '@/app/ui/inventory/use-inventory-refs';
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

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const vendors = useVendors();

  const [vendorId, setVendorId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  /**
   * FR-021 as a **filter**, not a count.
   *
   * "14 payments lack proof" makes somebody scroll a list looking for them; a filter hands them the
   * fourteen. `''` is all payments, so the absence of a choice is not a choice.
   */
  const [proof, setProof] = useState<'' | 'missing' | 'present'>('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    page,
    ...(vendorId ? { vendorId } : {}),
    ...(paymentMode ? { paymentMode } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(proof === 'missing' ? { missingProof: true } : {}),
    ...(proof === 'present' ? { missingProof: false } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'payments', filters],
    queryFn: () => getPayments(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete this payment.',
      ),
  });

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
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
          amountOrHidden(row.amount, row.amountHidden, formatRupees)
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
            {formatRupees(row.unallocatedBalance)}
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
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Record payment
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="payments-vendor"
          label="Vendor"
          value={vendorId}
          onChange={(event) => {
            setVendorId(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        >
          <option value="">All vendors</option>
          {(vendors.data ?? []).map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="payments-mode"
          label="Mode"
          value={paymentMode}
          onChange={(event) => {
            setPaymentMode(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
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
          value={proof}
          onChange={(event) => {
            setProof(event.target.value as '' | 'missing' | 'present');
            setPage(1);
          }}
        >
          <option value="">{DOCUMENT_COPY.proofFilterAll}</option>
          <option value="missing">{DOCUMENT_COPY.proofFilterMissing}</option>
          <option value="present">{DOCUMENT_COPY.proofFilterPresent}</option>
        </SelectField>

        <TextField
          id="payments-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
        <TextField
          id="payments-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            // Back to the first page: narrowing the list while on page
            // three would show an empty screen for a filter that matches.
            setPage(1);
          }}
        />
      </div>

      <FormError message={error} />

      {/* Said once, because a list that silently excludes rows is one somebody reads as the
          whole set. */}
      {proof === 'missing' && (
        <p className="text-sm text-amber-800">
          {DOCUMENT_COPY.proofFilterActive}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={data?.payments ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.paymentsEmpty}
        actions={(row) => (
          <RowAction
            onClick={() => {
              if (window.confirm(MESSAGES.confirmDeletePayment)) {
                remove.mutate(row.id);
              }
            }}
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
        onPageChange={setPage}
        noun="payment"
      />

      {showModal && <PaymentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

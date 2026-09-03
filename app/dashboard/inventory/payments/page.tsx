'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { deletePayment, getPayments, type Payment } from '@/app/lib/api/inventory';
import { MESSAGES, PAYMENT_MODES, inventoryLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import PaymentModal from '@/app/ui/inventory/payment-modal';
import { useVendors } from '@/app/ui/inventory/use-inventory-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const vendors = useVendors();

  const [vendorId, setVendorId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    ...(vendorId ? { vendorId } : {}),
    ...(paymentMode ? { paymentMode } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
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
      render: (row) => formatRupees(row.amount),
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
        <h1 className={`${lusitana.className} text-2xl`}>Payments</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          Record payment
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="payments-vendor"
          label="Vendor"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
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
          onChange={(event) => setPaymentMode(event.target.value)}
        >
          <option value="">Any mode</option>
          {PAYMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {inventoryLabel(mode)}
            </option>
          ))}
        </SelectField>

        <TextField
          id="payments-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <TextField
          id="payments-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
      </div>

      <FormError message={error} />

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

      {showModal && <PaymentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

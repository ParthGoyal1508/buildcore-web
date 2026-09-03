'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deletePurchase,
  getPurchases,
  type Purchase,
} from '@/app/lib/api/inventory';
import { MESSAGES, PURCHASE_BILL_STATUSES, inventoryLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { lusitana } from '@/app/ui/fonts';
import PurchaseModal from '@/app/ui/inventory/purchase-modal';
import { useSites, useVendors } from '@/app/ui/inventory/use-inventory-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const sites = useSites();
  const vendors = useVendors();

  const [siteId, setSiteId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    ...(siteId ? { siteId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'purchases', filters],
    queryFn: () => getPurchases(filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePurchase(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.status === 409
          ? MESSAGES.purchaseHasAllocations
          : 'Could not delete this purchase.',
      ),
  });

  const columns: Column<Purchase>[] = [
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
    { key: 'site', header: 'Store', render: (row) => row.siteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendorName },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'rate',
      header: 'Rate',
      hideOnCard: true,
      render: (row) => formatRupees(row.rate),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatRupees(row.amount),
    },
    {
      key: 'grn',
      header: 'GRN',
      hideOnCard: true,
      render: (row) => row.grnNumber ?? '—',
    },
    {
      key: 'bill',
      header: 'Bill',
      hideOnCard: true,
      render: (row) => (row.hasBillFile ? 'Attached' : '—'),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (row) => (
        <StatusBadge
          status={row.paymentStatus}
          label={inventoryLabel(row.paymentStatus)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Purchases</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          New purchase
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField
          id="purchases-site"
          label="Store"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">All stores</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="purchases-vendor"
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
          id="purchases-status"
          label="Payment"
          value={paymentStatus}
          onChange={(event) => setPaymentStatus(event.target.value)}
        >
          <option value="">Any status</option>
          {PURCHASE_BILL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {inventoryLabel(status)}
            </option>
          ))}
        </SelectField>

        <TextField
          id="purchases-from"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <TextField
          id="purchases-to"
          label="To"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.purchases ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.purchasesEmpty}
        actions={(row) => (
          <RowAction
            onClick={() => {
              if (window.confirm(MESSAGES.confirmDeletePurchase)) {
                remove.mutate(row.id);
              }
            }}
            disabled={remove.isPending}
          >
            Delete
          </RowAction>
        )}
      />

      {showModal && <PurchaseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteTransfer,
  getTransfers,
  updateTransferStatus,
  type Transfer,
} from '@/app/lib/api/inventory';
import {
  MESSAGES,
  TRANSFER_NEXT_STATUSES,
  TRANSFER_STATUSES,
  inventoryLabel,
  type TransferStatus,
} from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import TransferModal from '@/app/ui/inventory/transfer-modal';
import { useItems, useSites } from '@/app/ui/inventory/use-inventory-refs';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const sites = useSites();
  const items = useItems();

  const [fromSiteId, setFromSiteId] = useState('');
  const [itemId, setItemId] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = {
    ...(fromSiteId ? { fromSiteId } : {}),
    ...(itemId ? { itemId } : {}),
    ...(status ? { status } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['inventory', 'transfers', filters],
    queryFn: () => getTransfers(filters),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });

  const advance = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TransferStatus }) =>
      updateTransferStatus(id, next),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not update this transfer.',
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTransfer(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not delete this transfer.',
      ),
  });

  const columns: Column<Transfer>[] = [
    { key: 'date', header: 'Date', render: (row) => row.date.slice(0, 10) },
    { key: 'from', header: 'From', render: (row) => row.fromSiteName },
    { key: 'to', header: 'To', render: (row) => row.toSiteName },
    {
      key: 'item',
      header: 'Item',
      render: (row) => `${row.itemName} (${row.unit})`,
    },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.status} label={inventoryLabel(row.status)} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Transfers</h1>
        <SecondaryButton type="button" onClick={() => setShowModal(true)}>
          New transfer
        </SecondaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="transfers-from"
          label="From store"
          value={fromSiteId}
          onChange={(event) => setFromSiteId(event.target.value)}
        >
          <option value="">All stores</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="transfers-item"
          label="Item"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
        >
          <option value="">All items</option>
          {(items.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="transfers-status"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Any status</option>
          {TRANSFER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {inventoryLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={data?.transfers ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.inventoryLoadFailed : undefined}
        emptyMessage={MESSAGES.transfersEmpty}
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            {/* Only the transitions the backend will accept. Offering the rest
                would be offering a 409. */}
            {TRANSFER_NEXT_STATUSES[row.status].map((next) => (
              <RowAction
                key={next}
                onClick={() => advance.mutate({ id: row.id, next })}
                disabled={advance.isPending}
              >
                Mark {inventoryLabel(next).toLowerCase()}
              </RowAction>
            ))}
            <RowAction
              onClick={() => {
                if (window.confirm(MESSAGES.confirmDeleteTransfer)) {
                  remove.mutate(row.id);
                }
              }}
              // A received transfer is at the other store now; the backend refuses
              // to unwind it, and the control says so rather than finding out.
              disabled={row.status === 'received' || remove.isPending}
              title={
                row.status === 'received'
                  ? 'A received transfer can no longer be deleted.'
                  : undefined
              }
            >
              Delete
            </RowAction>
          </div>
        )}
      />

      {showModal && <TransferModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

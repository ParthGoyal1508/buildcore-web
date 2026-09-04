'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createTransfer, getStock, getStockHint } from '@/app/lib/api/inventory';
import { MESSAGES } from '@/app/lib/constants';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useSites } from './use-inventory-refs';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Move material between stores.
 *
 * Same shape as the issue form, with one addition: source and destination must
 * differ, and that is checked here before the request goes out. The backend refuses
 * it too (400) — this is not the guard, it is the guard's faster twin, so the user
 * finds out while looking at the two fields rather than after a round trip.
 */
export default function TransferModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const sites = useSites();

  const [fromSiteId, setFromSiteId] = useState('');
  const [toSiteId, setToSiteId] = useState('');
  const [itemId, setItemId] = useState('');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const stock = useQuery({
    queryKey: ['inventory', 'stock', { siteId: fromSiteId }],
    queryFn: () => getStock({ siteId: fromSiteId, pageSize: 200 }),
    enabled: Boolean(fromSiteId),
    select: (page) => page.rows.filter((row) => row.inStock > 0),
  });

  const hint = useQuery({
    queryKey: ['inventory', 'stock-hint', itemId, fromSiteId],
    queryFn: () => getStockHint(itemId, fromSiteId),
    enabled: Boolean(itemId && fromSiteId),
  });

  const sameSite = Boolean(fromSiteId) && fromSiteId === toSiteId;
  const available = hint.data?.inStock ?? null;
  const unit = hint.data?.unit ?? '';

  const save = useMutation({
    mutationFn: () =>
      createTransfer({
        fromSiteId,
        toSiteId,
        itemId,
        date,
        quantity: Number(quantity),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        setQuantityError(err.message);
        return;
      }
      setError(
        err instanceof ApiError ? err.message : 'Could not record this transfer.',
      );
    },
  });

  const ready =
    fromSiteId && toSiteId && !sameSite && itemId && date && Number(quantity) > 0;

  return (
    <Modal
      title="Transfer material"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="transfer-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Transfer'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="transfer-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setQuantityError(null);
          save.mutate();
        }}
      >
        <SelectField
          id="transfer-from"
          label="From store"
          value={fromSiteId}
          onChange={(event) => {
            setFromSiteId(event.target.value);
            // Changing the store invalidates the item choice: the previous
            // item may not exist at the new one (009 FR-005). Done here
            // rather than in an effect, which would be a second render
            // pass to undo state this one already knows is wrong.
            setItemId('');
          }}
        >
          <option value="">Select…</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="transfer-to"
          label="To store"
          value={toSiteId}
          onChange={(event) => setToSiteId(event.target.value)}
          error={sameSite ? MESSAGES.transferSameSite : undefined}
        >
          <option value="">Select…</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="transfer-item"
          label="Item"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          disabled={!fromSiteId || stock.isPending}
        >
          <option value="">
            {!fromSiteId
              ? 'Choose a source store first'
              : stock.isPending
                ? 'Loading…'
                : 'Select…'}
          </option>
          {(stock.data ?? []).map((row) => (
            <option key={row.itemId} value={row.itemId}>
              {row.itemName} — {row.inStock} {row.unit}
            </option>
          ))}
        </SelectField>

        <TextField
          id="transfer-date"
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="transfer-quantity"
          label="Quantity"
          type="number"
          min={0}
          step="any"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            setQuantityError(null);
          }}
          error={quantityError ?? undefined}
          hint={
            available !== null
              ? `Available at source: ${available} ${unit}`
              : itemId
                ? 'Checking available stock…'
                : undefined
          }
        />

        <TextField
          id="transfer-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

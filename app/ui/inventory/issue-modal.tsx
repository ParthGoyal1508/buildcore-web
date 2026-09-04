'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createIssue,
  getStock,
  getStockHint,
  type IssueInput,
} from '@/app/lib/api/inventory';
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
 * Issue material from a store.
 *
 * Two things make this screen different from the purchase form. The item list is
 * drawn from *what is actually in that store* rather than from the item master —
 * offering an item the store has never received is offering a choice that ends in a
 * 422. And the available quantity is fetched live for the chosen item-store pair, so
 * the number the user is typing against is the number the server will check.
 *
 * The hint is advisory, not authoritative. Between reading it and submitting, another
 * issue can take the same material; the backend's locked check is the only thing that
 * decides, and its 422 is shown against the quantity field rather than as a page
 * error (009 US4 AC2).
 */
export default function IssueModal({
  onClose,
  indentLineId,
  outstandingQuantity,
  defaults,
}: {
  onClose: () => void;
  /** Set when the issue is raised against an approved indent line (009 FR-023). */
  indentLineId?: string;
  /** The line's approved-minus-fulfilled figure, when there is one (009 FR-020). */
  outstandingQuantity?: number;
  defaults?: Partial<IssueInput>;
}) {
  const queryClient = useQueryClient();
  const sites = useSites();

  const [siteId, setSiteId] = useState(defaults?.siteId ?? '');
  const [itemId, setItemId] = useState(defaults?.itemId ?? '');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // Only what this store actually holds (009 research.md §7).
  const stock = useQuery({
    queryKey: ['inventory', 'stock', { siteId }],
    queryFn: () => getStock({ siteId, pageSize: 200 }),
    enabled: Boolean(siteId),
    select: (page) => page.rows.filter((row) => row.inStock > 0),
  });

  const hint = useQuery({
    queryKey: ['inventory', 'stock-hint', itemId, siteId],
    queryFn: () => getStockHint(itemId, siteId),
    enabled: Boolean(itemId && siteId),
  });

  const available = hint.data?.inStock ?? null;
  const unit = hint.data?.unit ?? '';

  const exceedsOutstanding =
    outstandingQuantity !== undefined &&
    quantity !== '' &&
    Number(quantity) > outstandingQuantity;

  const save = useMutation({
    mutationFn: () =>
      createIssue({
        siteId,
        itemId,
        date,
        quantity: Number(quantity),
        issuedTo: issuedTo.trim(),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        ...(indentLineId ? { indentLineId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        // Against the quantity field, where the user can act on it — not as a page
        // banner that loses the connection to what was typed.
        setQuantityError(err.message);
        return;
      }
      setError(
        err instanceof ApiError ? err.message : 'Could not record this issue.',
      );
    },
  });

  const ready =
    siteId &&
    itemId &&
    date &&
    Number(quantity) > 0 &&
    issuedTo.trim() &&
    !exceedsOutstanding;

  return (
    <Modal
      title="Issue material"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="issue-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Issue'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="issue-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setQuantityError(null);
          save.mutate();
        }}
      >
        <SelectField
          id="issue-site"
          label="Store"
          value={siteId}
          onChange={(event) => {
            setSiteId(event.target.value);
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
          id="issue-item"
          label="Item"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          disabled={!siteId || stock.isPending}
        >
          <option value="">
            {!siteId
              ? 'Choose a store first'
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
          id="issue-date"
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="issue-quantity"
          label="Quantity"
          type="number"
          min={0}
          step="any"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            setQuantityError(null);
          }}
          error={
            quantityError ??
            (exceedsOutstanding
              ? MESSAGES.outstandingExceeded(outstandingQuantity!)
              : undefined)
          }
          hint={
            available !== null
              ? MESSAGES.stockHint(available, unit)
              : itemId
                ? 'Checking available stock…'
                : undefined
          }
        />

        <TextField
          id="issue-to"
          label="Issued to"
          value={issuedTo}
          onChange={(event) => setIssuedTo(event.target.value)}
        />

        <TextField
          id="issue-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />

        {outstandingQuantity !== undefined && (
          <div className="sm:col-span-2">
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
              This indent line has {outstandingQuantity} outstanding.
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

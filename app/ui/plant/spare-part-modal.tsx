'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { getItems } from '@/app/lib/api/inventory';
import {
  createSparePart,
  receiveSparePart,
  updateSparePart,
  type SparePart,
} from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { usePlantCategories, usePlantVendors } from './use-plant-refs';

/**
 * Add or edit a spare part.
 *
 * The inventory-item link is optional and explicitly *not* a merge: the two stocks
 * stay independent by design (006 FR-024). Declaring it is what lets the
 * reconciliation view show a divergence rather than the same physical shelf being
 * counted twice in two modules and noticed by nobody. The hint says so, because
 * "link to inventory item" otherwise reads like it would keep them in step.
 */
export default function SparePartModal({
  part,
  onClose,
}: {
  part?: SparePart;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const categories = usePlantCategories();
  const isEdit = part !== undefined;

  const items = useQuery({
    queryKey: ['plant', 'inventory-items'],
    queryFn: () => getItems({ active: true, pageSize: 200 }),
    select: (page) => page.items,
  });

  const [partNumber, setPartNumber] = useState(part?.partNumber ?? '');
  const [name, setName] = useState(part?.name ?? '');
  const [unitOfMeasure, setUnitOfMeasure] = useState(
    part?.unitOfMeasure ?? 'NOS',
  );
  const [reorderLevel, setReorderLevel] = useState(
    part?.reorderLevel === null || part?.reorderLevel === undefined
      ? ''
      : String(part.reorderLevel),
  );
  const [compatibleCategoryIds, setCompatibleCategoryIds] = useState<string[]>(
    part?.compatibleCategoryIds ?? [],
  );
  const [linkedInventoryItemId, setLinkedInventoryItemId] = useState(
    part?.linkedInventoryItemId ?? '',
  );
  const [active, setActive] = useState(part?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        partNumber: partNumber.trim(),
        name: name.trim(),
        unitOfMeasure: unitOfMeasure.trim(),
        ...(reorderLevel ? { reorderLevel: Number(reorderLevel) } : {}),
        compatibleCategoryIds,
        ...(linkedInventoryItemId ? { linkedInventoryItemId } : {}),
      };
      return isEdit
        ? updateSparePart(part.id, { ...body, active })
        : createSparePart(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title={isEdit ? `Edit ${part.partNumber}` : 'Register a spare part'}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="part-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="part-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="part-number"
            label="Part number"
            required
            value={partNumber}
            onChange={(event) => setPartNumber(event.target.value)}
            hint="Unique within the company."
          />
          <TextField
            id="part-name"
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            id="part-unit"
            label="Unit"
            required
            value={unitOfMeasure}
            onChange={(event) => setUnitOfMeasure(event.target.value)}
            hint="NOS, SET, PAIR, METRE — whatever the workshop counts it in."
          />
          <TextField
            id="part-reorder"
            label="Reorder level"
            type="number"
            min={0}
            step="0.001"
            value={reorderLevel}
            onChange={(event) => setReorderLevel(event.target.value)}
            hint="Leave blank for a part that needs no floor."
          />
        </div>

        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Fits these categories
          </legend>
          <p className="mb-2 text-xs text-gray-500">
            Leave all unchecked for a part that fits anything. Fitting a part
            outside this list is allowed — it is flagged, never blocked.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(categories.data ?? []).map((category) => (
              <CheckboxField
                key={category.id}
                id={`part-category-${category.id}`}
                label={category.name}
                checked={compatibleCategoryIds.includes(category.id)}
                onChange={(event) =>
                  setCompatibleCategoryIds((current) =>
                    event.target.checked
                      ? [...current, category.id]
                      : current.filter((id) => id !== category.id),
                  )
                }
              />
            ))}
          </div>
        </fieldset>

        <SelectField
          id="part-inventory-link"
          label="Also stocked as an inventory item"
          value={linkedInventoryItemId}
          onChange={(event) => setLinkedInventoryItemId(event.target.value)}
          hint="The two stocks stay separate. Declaring the link only makes a divergence visible on the reconciliation view."
        >
          <option value="">Not linked</option>
          {(items.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </SelectField>

        {isEdit && (
          <CheckboxField
            id="part-active"
            label="Active"
            description="Retire a part instead of deleting it once it has movement history."
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}

/**
 * Receive stock against a part.
 *
 * Amount is computed live and read-only (web FR-012), matching the fuel form. The
 * new weighted average is previewed too: a receipt at a different rate moves the
 * rate every future consumption is valued at, and seeing where it lands before
 * saving is the whole reason the figure is interesting.
 */
export function ReceivePartModal({
  part,
  onClose,
}: {
  part: SparePart;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const vendors = usePlantVendors();

  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [vendorId, setVendorId] = useState('');
  const [billReference, setBillReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qty = quantity === '' ? 0 : Number(quantity);
  const unitRate = rate === '' ? 0 : Number(rate);
  const amount =
    quantity !== '' && rate !== ''
      ? Math.round(qty * unitRate * 100) / 100
      : null;

  // The same formula the backend applies (006 FR-017), weighted by *current* stock
  // rather than everything ever received.
  const newAverage =
    quantity !== '' && rate !== ''
      ? part.stockQuantity + qty === 0
        ? unitRate
        : (part.stockQuantity * part.avgRate + qty * unitRate) /
          (part.stockQuantity + qty)
      : null;

  const save = useMutation({
    mutationFn: () =>
      receiveSparePart(part.id, {
        quantity: qty,
        rate: unitRate,
        receiptDate,
        ...(vendorId ? { vendorId } : {}),
        ...(billReference.trim() ? { billReference: billReference.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title={`Receive ${part.partNumber}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="receive-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Receive'}
          </Button>
        </>
      }
    >
      <form
        id="receive-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <p className="text-sm text-gray-600">
          {part.stockQuantity} {part.unitOfMeasure} in stock at{' '}
          {formatRupees(part.avgRate)}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="receive-quantity"
            label={`Quantity (${part.unitOfMeasure})`}
            type="number"
            required
            min={0.001}
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField
            id="receive-rate"
            label="Rate (₹ per unit)"
            type="number"
            required
            min={0}
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>

        {/* Read-only and computed (web FR-012). */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Amount
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {amount === null ? '—' : formatRupees(amount)}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              New average rate
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {newAverage === null
                ? '—'
                : formatRupees(Math.round(newAverage * 100) / 100)}
            </p>
          </div>
        </div>

        <TextField
          id="receive-date"
          label="Receipt date"
          type="date"
          required
          value={receiptDate}
          onChange={(event) => setReceiptDate(event.target.value)}
        />

        <SelectField
          id="receive-vendor"
          label="Supplier"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
        >
          <option value="">Not recorded</option>
          {(vendors.data ?? []).map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="receive-bill"
          label="Bill reference"
          value={billReference}
          onChange={(event) => setBillReference(event.target.value)}
        />
      </form>
    </Modal>
  );
}

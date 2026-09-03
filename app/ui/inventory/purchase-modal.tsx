'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createPurchase, type PurchaseInput } from '@/app/lib/api/inventory';
import { formatRupees } from '@/app/lib/utils';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useItems, useSites, useVendors } from './use-inventory-refs';

/** Reads a file as base64 without the data-URL prefix, which is what the API takes. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

const today = () => new Date().toISOString().slice(0, 10);

export default function PurchaseModal({
  onClose,
  indentLineId,
  defaults,
}: {
  onClose: () => void;
  /** Set when the purchase is raised from an indent line, so the fulfilment is
   * recorded against it (009 FR-023). */
  indentLineId?: string;
  defaults?: Partial<PurchaseInput>;
}) {
  const queryClient = useQueryClient();
  const sites = useSites();
  const vendors = useVendors();
  const items = useItems();

  const [siteId, setSiteId] = useState(defaults?.siteId ?? '');
  const [itemId, setItemId] = useState(defaults?.itemId ?? '');
  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live, because the number a storekeeper is really checking is the total on the
  // vendor's bill — not the two figures it came from (009 FR-002).
  const amount =
    quantity && rate ? Number(quantity) * Number(rate) : Number.NaN;

  const save = useMutation({
    mutationFn: async () => {
      const input: PurchaseInput = {
        siteId,
        itemId,
        vendorId,
        date,
        quantity: Number(quantity),
        rate: Number(rate),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        ...(indentLineId ? { indentLineId } : {}),
      };
      if (file) {
        input.billFile = await readAsBase64(file);
        input.billContentType = file.type || 'application/octet-stream';
      }
      return createPurchase(input);
    },
    onSuccess: () => {
      // Every stock figure on every open screen is now stale.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not record this purchase.',
      ),
  });

  const ready =
    siteId && itemId && vendorId && date && Number(quantity) > 0 && rate !== '';

  return (
    <Modal
      title="New purchase"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="purchase-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Record purchase'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="purchase-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <SelectField
          id="purchase-site"
          label="Store"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">Select…</option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="purchase-item"
          label="Item"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
        >
          <option value="">Select…</option>
          {(items.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit})
            </option>
          ))}
        </SelectField>

        <SelectField
          id="purchase-vendor"
          label="Vendor"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
        >
          <option value="">Select…</option>
          {(vendors.data ?? []).map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="purchase-date"
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="purchase-quantity"
          label="Quantity"
          type="number"
          min={0}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />

        <TextField
          id="purchase-rate"
          label="Rate"
          type="number"
          min={0}
          step="any"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />

        <div className="sm:col-span-2">
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Amount:{' '}
            <span className="font-medium">
              {Number.isNaN(amount) ? '—' : formatRupees(amount)}
            </span>
          </p>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="purchase-bill"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Bill
          </label>
          <input
            id="purchase-bill"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional. PDF or an image of the vendor&apos;s bill.
          </p>
        </div>

        <div className="sm:col-span-2">
          <TextField
            id="purchase-remarks"
            label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

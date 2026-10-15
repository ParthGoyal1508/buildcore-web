'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createPurchase,
  GRN_CONDITIONS,
  type GrnDetails,
  type PurchaseInput,
} from '@/app/lib/api/inventory';
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

const EMPTY_GRN = {
  challanNo: '',
  vehicleNo: '',
  receivedQuantity: '',
  acceptedQuantity: '',
  rejectedQuantity: '',
  condition: '',
  batchDetails: '',
  discrepancy: '',
};

/**
 * The GRN's gate fields as typed, reduced to what was actually entered (2026-10-15).
 *
 * `undefined` when nothing was, so a purchase recorded without them sends no `grn` at all and
 * the GRN prints its blanks — rather than an object of empty strings the server would have to
 * tell apart from deliberate answers.
 */
function grnFrom(draft: typeof EMPTY_GRN): GrnDetails | undefined {
  const text = (value: string) => value.trim() || undefined;
  const number = (value: string) => (value === '' ? undefined : Number(value));
  const grn: GrnDetails = {
    challanNo: text(draft.challanNo),
    vehicleNo: text(draft.vehicleNo),
    receivedQuantity: number(draft.receivedQuantity),
    acceptedQuantity: number(draft.acceptedQuantity),
    rejectedQuantity: number(draft.rejectedQuantity),
    condition: (draft.condition || undefined) as GrnDetails['condition'],
    batchDetails: text(draft.batchDetails),
    discrepancy: text(draft.discrepancy),
  };
  const entered = Object.fromEntries(
    Object.entries(grn).filter(([, value]) => value !== undefined),
  ) as GrnDetails;
  return Object.keys(entered).length ? entered : undefined;
}

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
  const [grnDraft, setGrnDraft] = useState(EMPTY_GRN);
  const [error, setError] = useState<string | null>(null);

  // Live, because the number a storekeeper is really checking is the total on the
  // vendor's bill — not the two figures it came from (009 FR-002).
  const amount =
    quantity && rate ? Number(quantity) * Number(rate) : Number.NaN;

  const setGrn = (field: keyof typeof EMPTY_GRN) => (value: string) =>
    setGrnDraft((draft) => ({ ...draft, [field]: value }));
  // Accepted plus rejected is what was counted at the gate; when both are given and do not add up
  // to the received figure, say so here — the GRN would otherwise print three numbers that disagree.
  const grnMismatch =
    grnDraft.receivedQuantity !== '' &&
    grnDraft.acceptedQuantity !== '' &&
    grnDraft.rejectedQuantity !== '' &&
    Math.abs(
      Number(grnDraft.acceptedQuantity) +
        Number(grnDraft.rejectedQuantity) -
        Number(grnDraft.receivedQuantity),
    ) > 1e-9;

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
      const grn = grnFrom(grnDraft);
      if (grn) input.grn = grn;
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
    siteId &&
    itemId &&
    vendorId &&
    date &&
    Number(quantity) > 0 &&
    rate !== '' &&
    !grnMismatch;

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

        {/* Collapsed by default: most purchases are entered from the bill afterwards, and the
            gate's own count is the exception worth opening this for. */}
        <details className="rounded-md border border-gray-200 sm:col-span-2">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-900">
            GRN details (as received at the gate)
          </summary>
          <div className="grid gap-3 border-t border-gray-100 p-3 sm:grid-cols-2">
            <TextField
              id="grn-challan"
              label="Supplier challan no."
              autoComplete="off"
              value={grnDraft.challanNo}
              onChange={(event) => setGrn('challanNo')(event.target.value)}
            />
            <TextField
              id="grn-vehicle"
              label="Vehicle no."
              autoComplete="off"
              value={grnDraft.vehicleNo}
              onChange={(event) => setGrn('vehicleNo')(event.target.value)}
            />
            <TextField
              id="grn-received"
              label="Quantity received"
              type="number"
              min={0}
              step="any"
              value={grnDraft.receivedQuantity}
              onChange={(event) =>
                setGrn('receivedQuantity')(event.target.value)
              }
              hint="As counted at the gate, if it differs from the bill."
            />
            <SelectField
              id="grn-condition"
              label="Condition"
              value={grnDraft.condition}
              onChange={(event) => setGrn('condition')(event.target.value)}
            >
              <option value="">Not recorded</option>
              {GRN_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </SelectField>
            <TextField
              id="grn-accepted"
              label="Quantity accepted"
              type="number"
              min={0}
              step="any"
              value={grnDraft.acceptedQuantity}
              onChange={(event) =>
                setGrn('acceptedQuantity')(event.target.value)
              }
              error={
                grnMismatch
                  ? 'Accepted and rejected do not add up to the quantity received.'
                  : undefined
              }
            />
            <TextField
              id="grn-rejected"
              label="Quantity rejected"
              type="number"
              min={0}
              step="any"
              value={grnDraft.rejectedQuantity}
              onChange={(event) =>
                setGrn('rejectedQuantity')(event.target.value)
              }
            />
            <TextField
              id="grn-batch"
              label="Batch / lot details"
              autoComplete="off"
              value={grnDraft.batchDetails}
              onChange={(event) => setGrn('batchDetails')(event.target.value)}
            />
            <TextField
              id="grn-discrepancy"
              label="Discrepancy"
              autoComplete="off"
              value={grnDraft.discrepancy}
              onChange={(event) => setGrn('discrepancy')(event.target.value)}
            />
          </div>
        </details>

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

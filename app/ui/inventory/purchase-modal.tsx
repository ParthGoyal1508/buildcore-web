'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  completePurchase,
  createPurchase,
  getItem,
  getOpenPurchaseOrderLines,
  GRN_CONDITIONS,
  type GrnDetails,
  type Purchase,
  type PurchaseInput,
} from '@/app/lib/api/inventory';
import { getSite } from '@/app/lib/api/projects';
import { quantity as qty, rupees, todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import {
  itemOption,
  searchItems,
  searchSites,
  searchVendors,
  siteOption,
} from './inventory-search';
import SiteCapturePanel from './site-capture-panel';

/** Photos only, for the delivery photograph (the API refuses anything else with 415). */
const ACCEPT_PHOTOS =
  'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
/** The bill: the vendor's PDF or a photo of the paper bill (036 M11). */
const ACCEPT_BILL =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';

const today = () => todayIso();

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
  defaults: given,
  completing,
}: {
  onClose: () => void;
  /** Set when the purchase is raised from an indent line, so the fulfilment is
   * recorded against it (009 FR-023). */
  indentLineId?: string;
  defaults?: Partial<PurchaseInput>;
  /**
   * A site entry to complete (043): the same form, opened on what the site captured. The store and
   * photo stay as the site recorded them; the item, date and vehicle are prefilled and may be
   * corrected; vendor, quantity, rate and bill are Head Office's to add.
   */
  completing?: Purchase;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const defaults = completing
    ? { siteId: completing.siteId, itemId: completing.itemId }
    : given;

  const [siteId, setSiteId] = useState(defaults?.siteId ?? '');
  const [itemId, setItemId] = useState(defaults?.itemId ?? '');
  const [vendorId, setVendorId] = useState('');
  const [chosen, setChosen] = useState<{
    site?: SearchableOption | null;
    item?: SearchableOption | null;
    vendor?: SearchableOption | null;
  }>({});
  const [poLineId, setPoLineId] = useState('');
  const [billFile, setBillFile] = useState<PreparedFile | null>(null);
  const [photoFile, setPhotoFile] = useState<PreparedFile | null>(null);
  const [date, setDate] = useState(completing?.date.slice(0, 10) ?? today());
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [remarks, setRemarks] = useState(completing?.remarks ?? '');
  const [grnDraft, setGrnDraft] = useState({
    ...EMPTY_GRN,
    vehicleNo: completing?.vehicleNo ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  // An indent line fixes the store and the item (the API refuses any other, 036 M2), and a form
  // opened on known ids needs their names: the pickers no longer hold every row (036 M5). A site
  // entry fixes the store alone — it is where the photo was taken.
  const fixed = Boolean(indentLineId);
  const storeFixed = fixed || Boolean(completing);
  const defaultSite = useQuery({
    queryKey: ['inventory', 'site', defaults?.siteId],
    queryFn: () => getSite(defaults?.siteId ?? ''),
    enabled: Boolean(defaults?.siteId),
  });
  const defaultItem = useQuery({
    queryKey: ['inventory', 'item', defaults?.itemId],
    queryFn: () => getItem(defaults?.itemId ?? ''),
    enabled: Boolean(defaults?.itemId),
  });
  const siteSelected =
    chosen.site ?? (defaultSite.data ? siteOption(defaultSite.data) : null);
  const itemSelected =
    chosen.item ?? (defaultItem.data ? itemOption(defaultItem.data) : null);

  // 036 M9: the issued POs' open lines for this vendor and item. Receiving against one links the
  // GRN to the PO, so the PO shows what arrived; the server refuses more than is left.
  const poLines = useQuery({
    queryKey: ['inventory', 'purchase-orders', 'open-lines', vendorId, itemId],
    queryFn: () => getOpenPurchaseOrderLines({ vendorId, itemId }),
    enabled: Boolean(vendorId && itemId),
  });
  const poLine = (poLines.data ?? []).find((line) => line.id === poLineId);
  const overPo =
    poLine !== undefined &&
    quantity !== '' &&
    Math.round(Number(quantity) * 1000) >
      Math.round(poLine.remainingQuantity * 1000);

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
      // Without the store: a completion keeps the site's, where the photo was taken (043).
      const input: Omit<PurchaseInput, 'siteId'> = {
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
      if (poLine) input.purchaseOrderLineId = poLine.id;
      // Prepared by FileUpload: type-checked, size-checked and photos compressed before sending.
      if (billFile) {
        input.billFile = billFile.base64;
        input.billContentType = billFile.mimeType;
      }
      if (completing) return completePurchase(completing.id, input);
      if (photoFile) input.photoFile = photoFile.base64;
      return createPurchase({ ...input, siteId });
    },
    onSuccess: (purchase) => {
      // Every stock figure on every open screen is now stale.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(
        `Purchase ${completing ? 'completed' : 'recorded'}${purchase.grnNumber ? ` — ${purchase.grnNumber}` : ''}`,
      );
      onClose();
    },
    // The form stays as typed, so a refused purchase (over the PO, a rate that differs from the
    // agreed one, an inactive vendor) is corrected rather than re-entered.
    onError: (err) => setError(errorMessage(err, 'Could not record this purchase.')),
  });

  const ready =
    siteId &&
    itemId &&
    vendorId &&
    date &&
    Number(quantity) > 0 &&
    rate !== '' &&
    !grnMismatch &&
    !overPo;

  const pickerLabel = (htmlFor: string, text: string) => (
    <label htmlFor={htmlFor} className="font-medium text-gray-700">
      {text} <span className="text-red-600">*</span>
    </label>
  );

  return (
    <Modal
      title={completing ? 'Complete site entry' : 'New purchase'}
      onClose={onClose}
      wide
      isDirty={Boolean(
        vendorId || quantity || rate || remarks || billFile || photoFile,
      )}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="purchase-form"
            disabled={!ready}
            loading={save.isPending}
          >
            {completing ? 'Complete purchase' : 'Record purchase'}
          </Button>
        </>
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
        {completing && <SiteCapturePanel purchase={completing} />}

        <div className="flex flex-col gap-1 text-sm">
          {pickerLabel('purchase-site', 'Store')}
          <AsyncSelect
            id="purchase-site"
            value={siteId}
            onChange={(id, option) => {
              setSiteId(id);
              setChosen((c) => ({ ...c, site: option }));
            }}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={siteSelected}
            disabled={storeFixed}
            placeholder="Search stores"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          {pickerLabel('purchase-item', 'Item')}
          <AsyncSelect
            id="purchase-item"
            value={itemId}
            onChange={(id, option) => {
              setItemId(id);
              setPoLineId('');
              setChosen((c) => ({ ...c, item: option }));
            }}
            search={searchItems}
            cacheKey={['inventory', 'items', 'search', companyId]}
            selectedOption={itemSelected}
            disabled={fixed}
            placeholder="Search items by name or code"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          {pickerLabel('purchase-vendor', 'Vendor')}
          <AsyncSelect
            id="purchase-vendor"
            value={vendorId}
            onChange={(id, option) => {
              setVendorId(id);
              setPoLineId('');
              setChosen((c) => ({ ...c, vendor: option }));
            }}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={chosen.vendor}
            placeholder="Search active vendors by name or code"
          />
        </div>

        {vendorId && itemId && (poLines.data?.length ?? 0) > 0 && (
          <div className="sm:col-span-2">
            <SelectField
              id="purchase-po-line"
              label="Against purchase order"
              value={poLineId}
              onChange={(event) => {
                const id = event.target.value;
                setPoLineId(id);
                const line = poLines.data?.find((l) => l.id === id);
                // The PO's rate is what was agreed for this order; offered, still editable.
                if (line && rate === '') setRate(String(line.rate));
              }}
              hint={
                poLine
                  ? `${qty(poLine.remainingQuantity)} ${poLine.unit} left to receive of ${qty(poLine.quantity)} ordered at ${rupees(poLine.rate)}.`
                  : 'Link this delivery to the PO line it fills, so the PO shows what has arrived.'
              }
            >
              <option value="">Not against a PO</option>
              {(poLines.data ?? []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.referenceNo ?? 'PO'} · line {line.lineNo} —{' '}
                  {qty(line.remainingQuantity)} {line.unit} left
                </option>
              ))}
            </SelectField>
          </div>
        )}

        <TextField
          id="purchase-date"
          label="Date"
          type="date"
          required
          max={today()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="purchase-quantity"
          label="Quantity"
          type="number"
          inputMode="decimal"
          required
          min={0}
          max={poLine?.remainingQuantity}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={
            overPo && poLine
              ? `Only ${qty(poLine.remainingQuantity)} ${poLine.unit} left on this PO line.`
              : undefined
          }
        />

        <TextField
          id="purchase-rate"
          label="Rate (₹)"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />

        <div className="sm:col-span-2">
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Amount:{' '}
            <span className="font-medium">
              {Number.isNaN(amount) ? '—' : rupees(amount)}
            </span>
          </p>
        </div>

        <FileUpload
          id="purchase-bill"
          label="Bill"
          accept={ACCEPT_BILL}
          hint="Optional. The vendor's PDF, or a photo of the paper bill (up to 10 MB)."
          onSelect={setBillFile}
        />

        {/* A site entry's photo is the site's live capture, shown above and not replaceable. */}
        {!completing && (
          <FileUpload
            id="purchase-photo"
            label="Delivery photo"
            accept={ACCEPT_PHOTOS}
            hint="Optional. The load as it arrived at the gate."
            onSelect={setPhotoFile}
          />
        )}

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

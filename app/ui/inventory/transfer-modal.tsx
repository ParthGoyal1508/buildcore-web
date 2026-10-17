'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { createTransfer, getStockHint } from '@/app/lib/api/inventory';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { MESSAGES } from '@/app/lib/constants';
import { quantity as formatQuantity, todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import { searchSites, searchStoreStock } from './inventory-search';

const today = () => todayIso();

/**
 * Move material between stores.
 *
 * Same shape as the issue form, with one addition: source and destination must
 * differ, and that is checked here before the request goes out. The backend refuses
 * it too (400) — this is not the guard, it is the guard's faster twin, so the user
 * finds out while looking at the two fields rather than after a round trip.
 *
 * The dispatch details (2026-10-15) are what the client's stock transfer slip and delivery
 * challan print — vehicle, transporter, the request and indent/PO it answers, when it should
 * arrive and why it moved. All optional: a handcart between two stores on one site has none.
 *
 * 036 M3, M5 (2026-10-17): the stores and the item are server-search pickers. They loaded one page
 * of 200, so the 201st store or a store's 201st stocked item could not be moved at all. The item
 * picker searches what the source store holds and shows the quantity in stock beside each name.
 */
export default function TransferModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  const [fromSite, setFromSite] = useState<SearchableOption | null>(null);
  const [toSite, setToSite] = useState<SearchableOption | null>(null);
  const [item, setItem] = useState<SearchableOption | null>(null);
  const fromSiteId = fromSite?.id ?? '';
  const toSiteId = toSite?.id ?? '';
  const itemId = item?.id ?? '';
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transporter, setTransporter] = useState('');
  const [requestNo, setRequestNo] = useState('');
  const [dispatchReference, setDispatchReference] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

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
        ...(vehicleNo.trim() ? { vehicleNo: vehicleNo.trim() } : {}),
        ...(transporter.trim() ? { transporter: transporter.trim() } : {}),
        ...(requestNo.trim() ? { requestNo: requestNo.trim() } : {}),
        ...(dispatchReference.trim()
          ? { dispatchReference: dispatchReference.trim() }
          : {}),
        ...(expectedArrival ? { expectedArrival } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Transfer of ${item?.label ?? 'material'} recorded`);
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        setQuantityError(err.message);
        return;
      }
      setError(errorMessage(err, 'Could not record this transfer.'));
    },
  });

  const ready =
    fromSiteId &&
    toSiteId &&
    !sameSite &&
    itemId &&
    date &&
    Number(quantity) > 0;

  return (
    <Modal
      title="Transfer material"
      onClose={onClose}
      isDirty={Boolean(fromSiteId || toSiteId || itemId || quantity)}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="transfer-form"
            disabled={!ready}
            loading={save.isPending}
          >
            Transfer
          </Button>
        </>
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
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfer-from" className="font-medium text-gray-700">
            From store <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="transfer-from"
            value={fromSiteId}
            onChange={(_, option) => {
              setFromSite(option);
              // Changing the store invalidates the item choice: the previous
              // item may not exist at the new one (009 FR-005).
              setItem(null);
            }}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={fromSite}
            placeholder="Search stores"
          />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfer-to" className="font-medium text-gray-700">
            To store <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="transfer-to"
            value={toSiteId}
            onChange={(_, option) => setToSite(option)}
            search={searchSites}
            cacheKey={['inventory', 'sites', 'search', companyId]}
            selectedOption={toSite}
            placeholder="Search stores"
            invalid={sameSite}
            aria-describedby={sameSite ? 'transfer-to-error' : undefined}
          />
          {sameSite && (
            <p id="transfer-to-error" role="alert" className="text-xs text-red-600">
              {MESSAGES.transferSameSite}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="transfer-item" className="font-medium text-gray-700">
            Item <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            // Remounted per store so the search results are the new store's stock.
            key={fromSiteId || 'none'}
            id="transfer-item"
            value={itemId}
            onChange={(_, option) => setItem(option)}
            search={searchStoreStock(fromSiteId)}
            cacheKey={['inventory', 'stock', 'search', companyId, fromSiteId]}
            selectedOption={item}
            disabled={!fromSiteId}
            placeholder={
              fromSiteId ? 'Search this store’s stock' : 'Choose a source store first'
            }
          />
        </div>

        <TextField
          id="transfer-date"
          label="Date *"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          id="transfer-quantity"
          label={unit ? `Quantity (${unit}) *` : 'Quantity *'}
          type="number"
          inputMode="decimal"
          required
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
              ? `Available at source: ${formatQuantity(available)} ${unit}`
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

        <fieldset className="grid gap-3 border-t border-gray-100 pt-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="pt-3 text-sm font-medium text-gray-900">
            Dispatch details
          </legend>
          <TextField
            id="transfer-vehicle"
            label="Vehicle no."
            placeholder="e.g. KA01-AB-1234"
            autoComplete="off"
            value={vehicleNo}
            onChange={(event) => setVehicleNo(event.target.value)}
          />
          <TextField
            id="transfer-transporter"
            label="Transporter"
            autoComplete="off"
            value={transporter}
            onChange={(event) => setTransporter(event.target.value)}
          />
          <TextField
            id="transfer-request"
            label="Transfer request no."
            autoComplete="off"
            value={requestNo}
            onChange={(event) => setRequestNo(event.target.value)}
          />
          <TextField
            id="transfer-reference"
            label="Indent / PO reference"
            autoComplete="off"
            value={dispatchReference}
            onChange={(event) => setDispatchReference(event.target.value)}
          />
          <TextField
            id="transfer-arrival"
            label="Expected arrival"
            type="date"
            min={date || undefined}
            value={expectedArrival}
            onChange={(event) => setExpectedArrival(event.target.value)}
          />
          <TextField
            id="transfer-reason"
            label="Reason for transfer"
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </fieldset>

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

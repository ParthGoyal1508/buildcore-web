'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createFuelEntry } from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import {
  usePlantEquipment,
  usePlantSites,
  usePlantVendors,
} from './use-plant-refs';

/**
 * Record fuel drawn.
 *
 * Either the rate or the amount paid is typed and the other is computed and shown read-only
 * (2026-10-15). The pump slip and the log book's "Diesel Advance" give rupees paid, not a rate,
 * and making someone divide by hand is how the two came to disagree; whichever is typed is the
 * one sent, so the server derives the other from the same figure.
 *
 * Variance is deliberately *not* previewed here. It is measured against the day's
 * logbook entry and the machine category's own threshold, neither of which this form
 * has — showing a guess and then contradicting it on save would be worse than
 * showing nothing.
 */
export default function FuelModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();
  const vendors = usePlantVendors();
  const sites = usePlantSites();

  const [equipmentId, setEquipmentId] = useState('');
  /**
   * Where the fuel was drawn, blank until the machine is chosen.
   *
   * `''` means "follow the machine's deployment", which the API resolves at write time
   * and then stores. Captured rather than left to be derived on read: a site's fuel
   * figure computed from where the machine *now* stands restates itself every time one
   * is transferred.
   */
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [priceBy, setPriceBy] = useState<'rate' | 'amount'>('rate');
  const [cardNo, setCardNo] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amount =
    quantity !== '' && rate !== ''
      ? Math.round(Number(quantity) * Number(rate) * 100) / 100
      : null;
  const derivedRate =
    Number(quantity) > 0 && amountPaid !== ''
      ? Math.round((Number(amountPaid) / Number(quantity)) * 100) / 100
      : null;

  // Named in the default option, so "leave it alone" is a visible choice rather than a
  // blank that hides which site the entry will actually land against.
  const deployedSiteName =
    (equipment.data ?? []).find((machine) => machine.id === equipmentId)
      ?.siteName ?? null;

  const save = useMutation({
    mutationFn: () =>
      createFuelEntry({
        equipmentId,
        date,
        quantity: Number(quantity),
        ...(priceBy === 'rate'
          ? { rate: Number(rate) }
          : { amount: Number(amountPaid) }),
        ...(cardNo.trim() ? { cardNo: cardNo.trim() } : {}),
        ...(vendorId ? { vendorId } : {}),
        ...(siteId ? { siteId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed,
      ),
  });

  return (
    <Modal
      title="Record fuel"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="fuel-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="fuel-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <SelectField
          id="fuel-equipment"
          label="Machine"
          required
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
        >
          <option value="">Select a machine</option>
          {(equipment.data ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="fuel-date"
          label="Date"
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          hint="Variance is measured against this day's logbook entry."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="fuel-quantity"
            label="Quantity (litres)"
            type="number"
            required
            min={0}
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {priceBy === 'rate' ? (
            <TextField
              id="fuel-rate"
              label="Rate (₹ per litre)"
              type="number"
              required
              min={0}
              step="0.01"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          ) : (
            <TextField
              id="fuel-amount"
              label="Amount paid (₹)"
              type="number"
              required
              min={0}
              step="0.01"
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
            />
          )}
        </div>

        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
          <legend className="sr-only">Price entered as</legend>
          <span className="text-gray-500">Enter the</span>
          {(
            [
              ['rate', 'rate per litre'],
              ['amount', 'amount paid'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="fuel-price-by"
                value={value}
                checked={priceBy === value}
                onChange={() => setPriceBy(value)}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-accent-500"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {/* Read-only and computed (web FR-003): the other half of what was typed. */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            {priceBy === 'rate' ? 'Amount' : 'Rate per litre'}
          </span>
          <p
            aria-live="polite"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
          >
            {priceBy === 'rate'
              ? amount === null
                ? '—'
                : formatRupees(amount)
              : derivedRate === null
                ? '—'
                : formatRupees(derivedRate)}
          </p>
        </div>

        <TextField
          id="fuel-card"
          label="Card no."
          value={cardNo}
          maxLength={40}
          onChange={(event) => setCardNo(event.target.value)}
          hint="The fuel card it was drawn on, if any."
        />

        <SelectField
          id="fuel-vendor"
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

        <SelectField
          id="fuel-site"
          label="Site"
          hint="Where the fuel was drawn. Left alone it follows the machine's deployment, which is what the Site Dashboard's fuel cards read."
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">
            {deployedSiteName
              ? `Where the machine is deployed — ${deployedSiteName}`
              : 'Where the machine is deployed'}
          </option>
          {(sites.data ?? []).map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}

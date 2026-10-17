'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { createFuelEntry, type Equipment } from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { EquipmentPicker, SitePicker, VendorPicker } from './pickers';

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
 *
 * 036: machine, supplier and site are server-searched pickers (K15); the date cannot be in the
 * future and the quantity must be above zero (the API refuses both, K10); the form keeps what was
 * typed when a save fails, and asks before discarding it.
 */
export default function FuelModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [machine, setMachine] = useState<Equipment | null>(null);
  const equipmentId = machine?.id ?? '';
  /**
   * Where the fuel was drawn, blank until the machine is chosen.
   *
   * `''` means "follow the machine's deployment", which the API resolves at write time
   * and then stores. Captured rather than left to be derived on read: a site's fuel
   * figure computed from where the machine *now* stands restates itself every time one
   * is transferred.
   */
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState(todayIso());
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
  const deployedSiteName = machine?.siteName ?? null;
  const quantityInvalid = quantity !== '' && !(Number(quantity) > 0);
  const isDirty = Boolean(
    machine || quantity || rate || amountPaid || cardNo || vendorId || siteId,
  );

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
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success(
        `Recorded ${entry.quantity.toLocaleString('en-IN', {
          maximumFractionDigits: 3,
        })} litres for ${entry.equipmentCode}.`,
      );
      onClose();
    },
    onError: (err) => setError(errorMessage(err, MESSAGES.plantSaveFailed)),
  });

  return (
    <Modal
      title="Record fuel"
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="fuel-form"
            loading={save.isPending}
            disabled={!equipmentId || quantityInvalid}
          >
            Save
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

        <EquipmentPicker
          id="fuel-equipment"
          label="Machine"
          required
          value={equipmentId}
          onChange={(_, row) => setMachine(row)}
        />

        <TextField
          id="fuel-date"
          label="Date"
          type="date"
          required
          max={todayIso()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          hint="Variance is measured against this day's logbook entry."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="fuel-quantity"
            label="Quantity (litres)"
            type="number"
            inputMode="decimal"
            required
            min={0.001}
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={quantityInvalid ? 'Enter more than 0 litres.' : undefined}
          />
          {priceBy === 'rate' ? (
            <TextField
              id="fuel-rate"
              label="Rate (₹ per litre)"
              type="number"
              inputMode="decimal"
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
              inputMode="decimal"
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
                : rupees(amount)
              : derivedRate === null
                ? '—'
                : `${rupees(derivedRate)}/litre`}
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

        <VendorPicker
          id="fuel-vendor"
          label="Supplier"
          emptyLabel="Not recorded"
          value={vendorId}
          onChange={(id) => setVendorId(id)}
        />

        <SitePicker
          id="fuel-site"
          label="Site"
          hint="Where the fuel was drawn. Left alone it follows the machine's deployment, which is what the Site Dashboard's fuel cards read."
          emptyLabel={
            deployedSiteName
              ? `Where the machine is deployed — ${deployedSiteName}`
              : 'Where the machine is deployed'
          }
          value={siteId}
          onChange={(id) => setSiteId(id)}
        />
      </form>
    </Modal>
  );
}

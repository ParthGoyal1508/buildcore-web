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
import { usePlantEquipment, usePlantVendors } from './use-plant-refs';

/**
 * Record fuel drawn.
 *
 * Amount is computed live and rendered read-only (web FR-003), for the same reason
 * Total Hours is on the logbook form: it is `quantity × rate` and nothing else, so
 * an editable field could only ever disagree with the two above it.
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

  const [equipmentId, setEquipmentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amount =
    quantity !== '' && rate !== ''
      ? Math.round(Number(quantity) * Number(rate) * 100) / 100
      : null;

  const save = useMutation({
    mutationFn: () =>
      createFuelEntry({
        equipmentId,
        date,
        quantity: Number(quantity),
        rate: Number(rate),
        ...(vendorId ? { vendorId } : {}),
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
        </div>

        {/* Read-only and computed (web FR-003). */}
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
      </form>
    </Modal>
  );
}

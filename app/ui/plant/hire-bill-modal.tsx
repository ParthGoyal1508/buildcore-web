'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createHireBill, getHireRates } from '@/app/lib/api/plant';
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
import { usePlantEquipment } from './use-plant-refs';

/**
 * Raise a hire bill.
 *
 * Only hired machines are offered: a repair invoice for a machine you own is a
 * service bill, not a hire bill (006 FR-022), and the backend refuses it.
 *
 * Gross, TDS and Net Payable are all previewed read-only and none is an input
 * (web FR-013's rule, applied to the same class of figure). The TDS *rate* is not
 * previewed at all: it comes from the vendor's record in Partners and this form has
 * no honest value to show for it, so it says so rather than showing a guess it would
 * then contradict.
 */
export default function HireBillModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();

  const [equipmentId, setEquipmentId] = useState('');
  const [billedHours, setBilledHours] = useState('');
  const [rate, setRate] = useState('');
  const [billingPeriodFrom, setBillingPeriodFrom] = useState('');
  const [billingPeriodTo, setBillingPeriodTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hired = (equipment.data ?? []).filter(
    (row) => row.ownership === 'hired',
  );
  const machine = hired.find((row) => row.id === equipmentId);

  // The rate in force for this machine's category on the period's *start*, which is
  // what the backend will default to. Shown so the person raising the bill sees the
  // figure before saving rather than after.
  const rates = useQuery({
    queryKey: ['plant', 'rates', machine?.categoryId],
    queryFn: () => getHireRates(machine?.categoryId),
    enabled: machine !== undefined,
  });

  const effectiveRate =
    billingPeriodFrom && rates.data
      ? (rates.data.find(
          (row) =>
            row.effectiveFrom.slice(0, 10) <= billingPeriodFrom &&
            (row.effectiveTo === null ||
              row.effectiveTo.slice(0, 10) >= billingPeriodFrom),
        )?.ratePerUnit ?? null)
      : null;

  const appliedRate = rate !== '' ? Number(rate) : effectiveRate;
  const gross =
    appliedRate !== null && billedHours !== ''
      ? Math.round(Number(billedHours) * appliedRate * 100) / 100
      : null;

  const save = useMutation({
    mutationFn: () =>
      createHireBill({
        equipmentId,
        vendorId: machine?.vendorId ?? '',
        billedHours: Number(billedHours),
        ...(rate ? { rate: Number(rate) } : {}),
        billingPeriodFrom,
        billingPeriodTo,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  const noRate =
    machine !== undefined &&
    billingPeriodFrom !== '' &&
    rate === '' &&
    rates.isSuccess &&
    effectiveRate === null;

  return (
    <Modal
      title="Raise a hire bill"
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="hire-bill-form"
            disabled={save.isPending || noRate}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="hire-bill-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />
        {noRate && <FormError message={MESSAGES.plantNoHireRate} />}

        <SelectField
          id="hire-equipment"
          label="Hired machine"
          required
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
          hint={
            machine
              ? `Vendor: ${machine.vendorName ?? 'not recorded'}`
              : MESSAGES.plantHireBillOwned
          }
        >
          <option value="">Select a machine</option>
          {hired.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="hire-from"
            label="Billing period from"
            type="date"
            required
            value={billingPeriodFrom}
            onChange={(event) => setBillingPeriodFrom(event.target.value)}
          />
          <TextField
            id="hire-to"
            label="Billing period to"
            type="date"
            required
            value={billingPeriodTo}
            onChange={(event) => setBillingPeriodTo(event.target.value)}
          />
          <TextField
            id="hire-hours"
            label="Billed hours"
            type="number"
            required
            min={0}
            step="0.001"
            value={billedHours}
            onChange={(event) => setBilledHours(event.target.value)}
          />
          <TextField
            id="hire-rate"
            label="Rate override (₹)"
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            hint={
              effectiveRate === null
                ? 'Leave blank to use the effective hire rate for the period.'
                : `Leave blank to use ${formatRupees(effectiveRate)}, in force from the period's start date.`
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Gross amount
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {gross === null ? '—' : formatRupees(gross)}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              TDS and net payable
            </span>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Computed on save from the vendor’s own TDS rate.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Logbook hours for the period are captured when the bill is raised, so it
          stays checkable against what the logbook said at the time.
        </p>
      </form>
    </Modal>
  );
}

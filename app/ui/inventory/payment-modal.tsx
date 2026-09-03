'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createPayment, getVendorBills } from '@/app/lib/api/inventory';
import { MESSAGES, PAYMENT_MODES, inventoryLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useVendors } from './use-inventory-refs';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record a payment to a vendor.
 *
 * There is deliberately no allocation table here. The server allocates FIFO across
 * the vendor's oldest unpaid bills inside the same transaction that records the
 * payment (009 FR-005), so a client-side picker would be a second copy of a decision
 * that is already made — and one working from a snapshot another payment may have
 * invalidated a second ago. The outstanding total is shown, and it is shown as
 * information rather than as a control.
 */
export default function PaymentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const vendors = useVendors();

  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]>(
    'bank_transfer',
  );
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bills = useQuery({
    queryKey: ['inventory', 'bills', vendorId],
    queryFn: () => getVendorBills(vendorId),
    enabled: Boolean(vendorId),
  });

  const outstanding = bills.data?.totalOutstanding ?? null;
  const surplus =
    outstanding !== null && amount !== ''
      ? Number(amount) - outstanding
      : null;

  const save = useMutation({
    mutationFn: () =>
      createPayment({
        vendorId,
        amount: Number(amount),
        date,
        paymentMode,
        referenceNumber: referenceNumber.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not record this payment.',
      ),
  });

  const ready =
    vendorId && Number(amount) > 0 && date && referenceNumber.trim();

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="payment-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Record payment'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="payment-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <SelectField
          id="payment-vendor"
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
          id="payment-amount"
          label="Amount"
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <TextField
          id="payment-date"
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <SelectField
          id="payment-mode"
          label="Mode"
          value={paymentMode}
          onChange={(event) =>
            setPaymentMode(event.target.value as (typeof PAYMENT_MODES)[number])
          }
        >
          {PAYMENT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {inventoryLabel(mode)}
            </option>
          ))}
        </SelectField>

        <div className="sm:col-span-2">
          <TextField
            id="payment-reference"
            label="Reference"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            hint="UTR, cheque number or UPI reference."
          />
        </div>

        {vendorId && (
          <div className="sm:col-span-2 flex flex-col gap-2">
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Outstanding:{' '}
              <span className="font-medium">
                {bills.isPending
                  ? 'Checking…'
                  : outstanding === null
                    ? '—'
                    : formatRupees(outstanding)}
              </span>
              {bills.data && bills.data.bills.length > 0 && (
                <span className="block text-xs text-gray-500">
                  Across {bills.data.bills.length} unpaid bill
                  {bills.data.bills.length === 1 ? '' : 's'}.
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">{MESSAGES.paymentFifoNote}</p>
            {surplus !== null && surplus > 0 && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
                {formatRupees(surplus)} of this payment has no bill to settle and
                will be recorded as an advance.
              </p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

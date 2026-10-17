'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { createPayment, getVendorBills } from '@/app/lib/api/inventory';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { useCashRights } from '@/app/lib/cash-entry';
import { MESSAGES, PAYMENT_MODES, inventoryLabel } from '@/app/lib/constants';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import { searchVendors } from './inventory-search';

const today = () => todayIso();

/** One key per form submission; a fresh one only once a payment has actually been recorded. */
const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Record a payment to a vendor.
 *
 * There is deliberately no allocation table here. The server allocates FIFO across
 * the vendor's oldest unpaid bills inside the same transaction that records the
 * payment (009 FR-005), so a client-side picker would be a second copy of a decision
 * that is already made — and one working from a snapshot another payment may have
 * invalidated a second ago. The outstanding total is shown, and it is shown as
 * information rather than as a control.
 *
 * 036 M10:
 * - **Reference optional for cash.** Cash has no UTR or cheque number; requiring one made people
 *   type "cash" into it.
 * - **A confirmation step** summarising vendor, amount, mode and date before money is recorded.
 * - **An `Idempotency-Key` per submission**, kept across retries of the same form: a double click
 *   or a retry after a dropped response replays the first payment rather than recording a second.
 *   A new key is drawn only after a payment is recorded.
 * - **Warnings shown** — a reference already used on another payment is recorded, and said.
 */
export default function PaymentModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  // 019 FR-017a. Hidden, not disabled: a disabled option invites a support call, and the
  // client's intent is that the machinery of cash is not visible at all to an office viewer.
  const { mayEnterCash } = useCashRights();
  const offeredModes = mayEnterCash
    ? PAYMENT_MODES
    : PAYMENT_MODES.filter((mode) => mode !== 'cash');

  const [vendor, setVendor] = useState<SearchableOption | null>(null);
  const vendorId = vendor?.id ?? '';
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [paymentMode, setPaymentMode] =
    useState<(typeof PAYMENT_MODES)[number]>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newKey());

  const bills = useQuery({
    queryKey: ['inventory', 'bills', vendorId],
    queryFn: () => getVendorBills(vendorId),
    enabled: Boolean(vendorId),
  });

  const outstanding = bills.data?.totalOutstanding ?? null;
  const surplus =
    outstanding !== null && amount !== '' ? Number(amount) - outstanding : null;
  const isCash = paymentMode === 'cash';

  const save = useMutation({
    mutationFn: () =>
      createPayment(
        {
          vendorId,
          amount: Number(amount),
          date,
          paymentMode,
          ...(referenceNumber.trim()
            ? { referenceNumber: referenceNumber.trim() }
            : {}),
        },
        idempotencyKey.current,
      ),
    onSuccess: (payment) => {
      idempotencyKey.current = newKey();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(
        payment.replayed
          ? 'This payment was already recorded — nothing new was added.'
          : `Payment of ${rupees(Number(amount))} recorded`,
      );
      for (const warning of payment.warnings) toast.info(warning);
      onClose();
    },
    // The key is kept: retrying this same form must not record a second payment.
    onError: (err) => setError(errorMessage(err, 'Could not record this payment.')),
  });

  const ready =
    vendorId && Number(amount) > 0 && date && (isCash || referenceNumber.trim());

  const submit = async () => {
    setError(null);
    const confirmed = await confirmDialog({
      title: 'Record this payment?',
      message:
        `${rupees(Number(amount))} to ${vendor?.label ?? 'the vendor'} by ` +
        `${inventoryLabel(paymentMode)} on ${dateLabel(date)}` +
        (referenceNumber.trim() ? `, reference ${referenceNumber.trim()}` : '') +
        '. It is allocated to the oldest unpaid bills first.',
      confirmLabel: 'Record payment',
    });
    if (confirmed) save.mutate();
  };

  return (
    <Modal
      title="Record payment"
      onClose={onClose}
      isDirty={Boolean(vendorId || amount || referenceNumber)}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="payment-form"
            disabled={!ready}
            loading={save.isPending}
          >
            Record payment
          </Button>
        </>
      }
    >
      <form
        id="payment-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <label htmlFor="payment-vendor" className="font-medium text-gray-700">
            Vendor <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="payment-vendor"
            value={vendorId}
            onChange={(_, option) => setVendor(option)}
            search={searchVendors}
            cacheKey={['inventory', 'vendors', 'search', companyId]}
            selectedOption={vendor}
            placeholder="Search active vendors by name or code"
          />
        </div>

        <TextField
          id="payment-amount"
          label="Amount (₹) *"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <TextField
          id="payment-date"
          label="Date *"
          type="date"
          required
          max={today()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <SelectField
          id="payment-mode"
          label="Mode *"
          value={paymentMode}
          onChange={(event) =>
            setPaymentMode(event.target.value as (typeof PAYMENT_MODES)[number])
          }
        >
          {offeredModes.map((mode) => (
            <option key={mode} value={mode}>
              {inventoryLabel(mode)}
            </option>
          ))}
        </SelectField>

        {!mayEnterCash && (
          // FR-014: a screen that loses a control must say so. Without this the mode list is
          // simply one item shorter and the viewer has no way to tell a missing permission from
          // a missing feature.
          <p className="sm:col-span-2 text-xs text-gray-500">
            {MESSAGES.cashEntryUnavailable}
          </p>
        )}

        <div className="sm:col-span-2">
          <TextField
            id="payment-reference"
            label={isCash ? 'Reference (optional for cash)' : 'Reference *'}
            required={!isCash}
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            hint={
              isCash
                ? 'A receipt or voucher number, if there is one.'
                : 'UTR, cheque number or UPI reference.'
            }
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
                    : rupees(outstanding)}
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
              <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
                {rupees(surplus)} of this payment has no bill to settle and
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

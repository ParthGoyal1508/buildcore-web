'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { getHireRates } from '@/app/lib/api/plant';
import {
  createHireBillFull,
  getHireOrders,
  updateHireBill,
  type HireBillBasis,
  type HireBillFull,
} from '@/app/lib/api/plant-hire';
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
  usePlantCompanyId,
  usePlantEquipment,
  usePlantVendors,
} from './use-plant-refs';
import VendorOptions from './vendor-options';
import { dateLabel } from '@/app/lib/format';

/** A number field's value as the API wants it: absent when blank, so the server's default holds. */
const optionalNumber = (value: string) =>
  value.trim() === '' ? undefined : Number(value);
const optionalText = (value: string) => value.trim() || undefined;

/** A small heading that splits the long form into the bill's own blocks (2026-10-15). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-gray-200 pt-4">
      <legend className="pr-2 text-sm font-semibold text-gray-900">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function ReadOnlyFigure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </span>
      <p
        aria-live="polite"
        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
      >
        {children}
      </p>
    </div>
  );
}

/**
 * Raise a hire bill.
 *
 * Only hired machines are offered: a repair invoice for a machine you own is a
 * service bill, not a hire bill (006 FR-022), and the backend refuses it. Leased machines
 * are paid the same way (2026-10-15), so anything not `owned` is offered.
 *
 * Gross, TDS and Net Payable are all previewed read-only and none is an input
 * (web FR-013's rule, applied to the same class of figure). The TDS *rate* is not
 * previewed at all: it comes from the vendor's record in Partners and this form has
 * no honest value to show for it, so it says so rather than showing a guess it would
 * then contradict.
 *
 * The vendor is the machine's own when its record names one. When it does not, the form asks
 * for it (2026-10-15): it used to send an empty id and show the API's "vendorId should not be
 * empty", which told the person nothing they could act on. Hire vendors are listed first.
 *
 * The client's VEHICLE HIRING BILL format (2026-10-15) added a monthly-rent basis, the hire
 * order the bill is raised under, the vendor's invoice references, the operating details
 * (agreed average, readings) and a deduction and hold. Every one of those the server can
 * work out — readings from the logbook, average from the category benchmark, deduction from
 * the diesel the company supplied — is left blank to mean "work it out", and its hint says so.
 */
export default function HireBillModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const companyId = usePlantCompanyId();
  const equipment = usePlantEquipment();
  const vendors = usePlantVendors();

  const [equipmentId, setEquipmentId] = useState('');
  const [chosenVendorId, setChosenVendorId] = useState('');
  const [basis, setBasis] = useState<HireBillBasis>('hours');
  const [hireOrderId, setHireOrderId] = useState('');
  const [billedHours, setBilledHours] = useState('');
  const [rate, setRate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [periodDays, setPeriodDays] = useState('');
  const [billingPeriodFrom, setBillingPeriodFrom] = useState('');
  const [billingPeriodTo, setBillingPeriodTo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [taxInvoiceRef, setTaxInvoiceRef] = useState('');
  const [taxInvoiceDate, setTaxInvoiceDate] = useState('');
  const [description, setDescription] = useState('');
  const [agreedAverage, setAgreedAverage] = useState('');
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [holdAmount, setHoldAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const billable = (equipment.data ?? []).filter(
    (row) => row.ownership !== 'owned',
  );
  const machine = billable.find((row) => row.id === equipmentId);
  const machineVendorId = machine?.vendorId ?? null;
  const vendorId = machineVendorId ?? chosenVendorId;
  const monthly = basis === 'monthly';
  const km = machine?.meterType === 'km';

  // The rate in force for this machine's category on the period's *start*, which is
  // what the backend will default to. Shown so the person raising the bill sees the
  // figure before saving rather than after.
  const rates = useQuery({
    queryKey: ['plant', 'rates', machine?.categoryId],
    queryFn: () => getHireRates(machine?.categoryId),
    enabled: machine !== undefined,
  });

  // Only this vendor's orders: the server refuses a bill under another vendor's order.
  const orders = useQuery({
    queryKey: ['plant', 'hire-orders', { companyId, vendorId }],
    queryFn: () =>
      getHireOrders({ ...(companyId ? { companyId } : {}), vendorId }),
    enabled: vendorId !== '',
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

  // Inclusive days in the period, and the days of the period's own month — the server's
  // pro-rating for a monthly rent: the whole rent for a whole month, by the day otherwise.
  const daysInPeriod =
    billingPeriodFrom && billingPeriodTo
      ? Math.round(
          (Date.parse(billingPeriodTo) - Date.parse(billingPeriodFrom)) /
            86_400_000,
        ) + 1
      : null;
  const daysInMonth = billingPeriodFrom
    ? new Date(
        Date.UTC(
          Number(billingPeriodFrom.slice(0, 4)),
          Number(billingPeriodFrom.slice(5, 7)),
          0,
        ),
      ).getUTCDate()
    : null;
  const days = periodDays !== '' ? Number(periodDays) : daysInPeriod;

  const appliedRate = rate !== '' ? Number(rate) : effectiveRate;
  const gross = monthly
    ? monthlyRate !== '' && days && daysInMonth
      ? Math.round(((Number(monthlyRate) * days) / daysInMonth) * 100) / 100
      : null
    : appliedRate !== null && billedHours !== ''
      ? Math.round(Number(billedHours) * appliedRate * 100) / 100
      : null;

  const save = useMutation({
    mutationFn: () =>
      createHireBillFull({
        equipmentId,
        vendorId,
        basis,
        billingPeriodFrom,
        billingPeriodTo,
        ...(monthly
          ? {
              monthlyRate: Number(monthlyRate),
              billedHours: optionalNumber(billedHours),
              periodDays: optionalNumber(periodDays),
            }
          : {
              billedHours: Number(billedHours),
              rate: optionalNumber(rate),
            }),
        hireOrderId: optionalText(hireOrderId),
        billDate: optionalText(billDate),
        invoiceNo: optionalText(invoiceNo),
        taxInvoiceRef: optionalText(taxInvoiceRef),
        taxInvoiceDate: optionalText(taxInvoiceDate),
        description: optionalText(description),
        agreedAverage: optionalNumber(agreedAverage),
        startReading: optionalNumber(startReading),
        endReading: optionalNumber(endReading),
        deductionAmount: optionalNumber(deductionAmount),
        holdAmount: optionalNumber(holdAmount),
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

  // A monthly bill names its own rent, so the category's hire rate does not come into it.
  const noRate =
    !monthly &&
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
            disabled={save.isPending || noRate || !vendorId}
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
          onChange={(event) => {
            setEquipmentId(event.target.value);
            // An order belongs to a vendor; a different machine may be billed by another.
            setHireOrderId('');
          }}
          hint={
            machine && machineVendorId
              ? `Vendor: ${machine.vendorName ?? 'not recorded'}`
              : machine
                ? undefined
                : MESSAGES.plantHireBillOwned
          }
        >
          <option value="">Select a machine</option>
          {billable.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>

        {machine && !machineVendorId && (
          <SelectField
            id="hire-vendor"
            label="Vendor"
            required
            value={chosenVendorId}
            onChange={(event) => {
              setChosenVendorId(event.target.value);
              setHireOrderId('');
            }}
            hint="This machine's record names no vendor — choose who is billing. Recording it on the machine saves asking next time."
          >
            <option value="">Select the hire vendor</option>
            <VendorOptions vendors={vendors.data ?? []} />
          </SelectField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-gray-700">
              Billed by
            </legend>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-gray-300 bg-gray-50 p-1">
              {(
                [
                  ['hours', 'By hours'],
                  ['monthly', 'Monthly rent'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={clsx(
                    'flex min-h-9 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500',
                    basis === value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900',
                  )}
                >
                  <input
                    type="radio"
                    name="hire-basis"
                    value={value}
                    checked={basis === value}
                    onChange={() => setBasis(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <SelectField
            id="hire-order"
            label="Hire order"
            value={hireOrderId}
            disabled={vendorId === ''}
            onChange={(event) => setHireOrderId(event.target.value)}
            hint={
              vendorId === ''
                ? 'Choose the machine first — orders are listed for its vendor.'
                : orders.data && orders.data.length === 0
                  ? 'This vendor has no work orders yet.'
                  : undefined
            }
          >
            <option value="">Not under a work order</option>
            {(orders.data ?? []).map((order) => (
              <option key={order.id} value={order.id}>
                {order.code} · {dateLabel(order.date)}
                {order.lines[0] ? ` · ${order.lines[0].title}` : ''}
              </option>
            ))}
          </SelectField>
        </div>

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
          {monthly ? (
            <>
              <TextField
                id="hire-monthly-rate"
                label="Monthly rent (₹)"
                type="number"
                required
                min={0}
                step="0.01"
                value={monthlyRate}
                onChange={(event) => setMonthlyRate(event.target.value)}
                hint="The whole month's rent; pro-rated by the days billed."
              />
              <TextField
                id="hire-days"
                label="Days billed"
                type="number"
                min={1}
                step="1"
                value={periodDays}
                onChange={(event) => setPeriodDays(event.target.value)}
                hint={
                  daysInPeriod
                    ? `Leave blank for the ${daysInPeriod} days in the period.`
                    : 'Leave blank for the days in the period.'
                }
              />
              <TextField
                id="hire-hours"
                label={km ? 'Km run' : 'Hours run'}
                type="number"
                min={0}
                step="0.001"
                value={billedHours}
                onChange={(event) => setBilledHours(event.target.value)}
                hint="Leave blank for the run between the start and end readings."
              />
            </>
          ) : (
            <>
              <TextField
                id="hire-hours"
                label={km ? 'Billed km' : 'Billed hours'}
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
            </>
          )}
        </div>

        <Section title="Invoice reference">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="hire-bill-date"
              label="Bill date"
              type="date"
              value={billDate}
              onChange={(event) => setBillDate(event.target.value)}
              hint="Leave blank for today."
            />
            <TextField
              id="hire-invoice-no"
              label="Reference Invoice No."
              maxLength={40}
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
            <TextField
              id="hire-tax-ref"
              label="Tax invoice ref."
              maxLength={40}
              value={taxInvoiceRef}
              onChange={(event) => setTaxInvoiceRef(event.target.value)}
            />
            <TextField
              id="hire-tax-date"
              label="Tax invoice date"
              type="date"
              value={taxInvoiceDate}
              onChange={(event) => setTaxInvoiceDate(event.target.value)}
            />
          </div>
          <TextField
            id="hire-description"
            label="Description"
            maxLength={200}
            placeholder="Monthly vehicle rent – FARANA"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Section>

        <Section title="Operating details">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="hire-average"
              label={km ? 'Agreed average (km/l)' : 'Agreed average (l/hr)'}
              type="number"
              min={0}
              step="0.001"
              value={agreedAverage}
              onChange={(event) => setAgreedAverage(event.target.value)}
              hint="Leave blank for the category's fuel benchmark."
            />
            <TextField
              id="hire-start-reading"
              label={km ? 'Start odometer' : 'Start hour meter'}
              type="number"
              min={0}
              step="0.001"
              value={startReading}
              onChange={(event) => setStartReading(event.target.value)}
              hint="Leave blank to take it from the logbook."
            />
            <TextField
              id="hire-end-reading"
              label={km ? 'End odometer' : 'End hour meter'}
              type="number"
              min={0}
              step="0.001"
              value={endReading}
              onChange={(event) => setEndReading(event.target.value)}
              hint="Leave blank to take it from the logbook."
            />
          </div>
        </Section>

        <Section title="Deductions">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="hire-deduction"
              label="Deduction amount (₹)"
              type="number"
              min={0}
              step="0.01"
              value={deductionAmount}
              onChange={(event) => setDeductionAmount(event.target.value)}
              hint="Leave blank for the diesel the company supplied in the period, at cost."
            />
            <TextField
              id="hire-hold"
              label="Debit / Hold amount (₹)"
              type="number"
              min={0}
              step="0.01"
              value={holdAmount}
              onChange={(event) => setHoldAmount(event.target.value)}
            />
          </div>
        </Section>

        <div className="grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2">
          <ReadOnlyFigure label="Gross amount">
            {gross === null ? '—' : formatRupees(gross)}
          </ReadOnlyFigure>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              TDS and net payable
            </span>
            <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Computed on save from the vendor’s own TDS rate, less the
              deduction and hold.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Logbook hours for the period are captured when the bill is raised, so
          it stays checkable against what the logbook said at the time.
        </p>
      </form>
    </Modal>
  );
}

/**
 * Correct a bill before it is verified (2026-10-15): the printed references, the agreed
 * average, the deduction and the hold. The server recomputes the net from them; the period,
 * machine and rent are not correctable here — a bill raised wrongly in those is deleted and
 * raised again, which is a decision this form should not make quietly.
 */
export function HireBillCorrectionModal({
  bill,
  onClose,
}: {
  bill: HireBillFull;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const km = bill.meterType === 'km';
  const text = (value: string | null) => value ?? '';
  const figure = (value: number | null) =>
    value === null ? '' : String(value);

  const [billDate, setBillDate] = useState(text(bill.billDate).slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState(text(bill.invoiceNo));
  const [taxInvoiceRef, setTaxInvoiceRef] = useState(text(bill.taxInvoiceRef));
  const [taxInvoiceDate, setTaxInvoiceDate] = useState(
    text(bill.taxInvoiceDate).slice(0, 10),
  );
  const [description, setDescription] = useState(text(bill.description));
  const [agreedAverage, setAgreedAverage] = useState(
    figure(bill.agreedAverage),
  );
  const [deductionAmount, setDeductionAmount] = useState(
    figure(bill.deductionAmount),
  );
  const [holdAmount, setHoldAmount] = useState(figure(bill.holdAmount));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateHireBill(bill.id, {
        billDate: optionalText(billDate),
        // Text fields are sent even when emptied, so clearing one actually clears it.
        invoiceNo: invoiceNo.trim(),
        taxInvoiceRef: taxInvoiceRef.trim(),
        taxInvoiceDate: optionalText(taxInvoiceDate),
        description: description.trim(),
        agreedAverage: optionalNumber(agreedAverage),
        deductionAmount: optionalNumber(deductionAmount),
        holdAmount: optionalNumber(holdAmount),
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
      title={`Correct hire bill — ${bill.equipmentCode}`}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="hire-bill-edit-form"
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="hire-bill-edit-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          {bill.vendorName} · {dateLabel(bill.billingPeriodFrom)} →{' '}
          {dateLabel(bill.billingPeriodTo)} ·{' '}
          {bill.basis === 'monthly' ? 'Monthly rent' : 'By hours'}
          {bill.hireOrderCode ? ` · Work order ${bill.hireOrderCode}` : ''}
        </p>

        <Section title="Invoice reference">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="hire-edit-bill-date"
              label="Bill date"
              type="date"
              value={billDate}
              onChange={(event) => setBillDate(event.target.value)}
            />
            <TextField
              id="hire-edit-invoice-no"
              label="Reference Invoice No."
              maxLength={40}
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
            <TextField
              id="hire-edit-tax-ref"
              label="Tax invoice ref."
              maxLength={40}
              value={taxInvoiceRef}
              onChange={(event) => setTaxInvoiceRef(event.target.value)}
            />
            <TextField
              id="hire-edit-tax-date"
              label="Tax invoice date"
              type="date"
              value={taxInvoiceDate}
              onChange={(event) => setTaxInvoiceDate(event.target.value)}
            />
          </div>
          <TextField
            id="hire-edit-description"
            label="Description"
            maxLength={200}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Section>

        <Section title="Average and deductions">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="hire-edit-average"
              label={km ? 'Agreed average (km/l)' : 'Agreed average (l/hr)'}
              type="number"
              min={0}
              step="0.001"
              value={agreedAverage}
              onChange={(event) => setAgreedAverage(event.target.value)}
            />
            <TextField
              id="hire-edit-deduction"
              label="Deduction amount (₹)"
              type="number"
              min={0}
              step="0.01"
              value={deductionAmount}
              onChange={(event) => setDeductionAmount(event.target.value)}
            />
            <TextField
              id="hire-edit-hold"
              label="Debit / Hold amount (₹)"
              type="number"
              min={0}
              step="0.01"
              value={holdAmount}
              onChange={(event) => setHoldAmount(event.target.value)}
            />
          </div>
        </Section>

        <div className="grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3">
          <ReadOnlyFigure label="Gross">
            {formatRupees(bill.grossAmount)}
          </ReadOnlyFigure>
          <ReadOnlyFigure label="TDS">
            {formatRupees(bill.tdsAmount)}
          </ReadOnlyFigure>
          <ReadOnlyFigure label="Net payable (as saved)">
            {formatRupees(bill.netPayable)}
          </ReadOnlyFigure>
        </div>
        <p className="text-xs text-gray-500">
          Readings {bill.startReading ?? '—'} → {bill.endReading ?? '—'} ·
          diesel supplied {bill.dieselGiven ?? '—'} l against{' '}
          {bill.actualDiesel ?? '—'} l by the agreed average. Net payable is
          recomputed on save.
        </p>
      </form>
    </Modal>
  );
}

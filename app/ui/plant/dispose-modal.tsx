'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  disposeEquipment,
  getDisposalPreview,
  type DisposeInput,
} from '@/app/lib/api/plant';
import {
  DISPOSAL_PAYMENT_MODE_LABELS,
  DISPOSAL_PAYMENT_MODES,
  SCRAP_REASON_LABELS,
  SCRAP_REASONS,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import { toBase64 } from '@/app/ui/plant/document-modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { todayIso } from '@/app/lib/format';

const MAX_BYTES = 10 * 1024 * 1024;

/** A rupee amount typed into a field, or undefined when blank. */
const amountOf = (value: string) =>
  value.trim() === '' ? undefined : Number(value);

/**
 * Mark a machine as Scrapped or Sold (2026-10-17). Two steps, because this takes the machine out
 * of every working list: the form, then a confirmation that says exactly what will happen —
 * including the site it will be released from, which the client chose over refusing.
 */
export default function DisposeModal({
  equipment,
  initialType,
  onClose,
  onDone,
}: {
  equipment: { id: string; code: string; name: string };
  initialType: 'scrapped' | 'sold';
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [type, setType] = useState(initialType);
  const [date, setDate] = useState(todayIso);
  const [scrapReason, setScrapReason] = useState('');
  const [party, setParty] = useState('');
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [invoice, setInvoice] = useState('');
  const [manualBook, setManualBook] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ['plant', 'disposal-preview', equipment.id, date],
    queryFn: () => getDisposalPreview(equipment.id, date),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
  });

  const isSale = type === 'sold';
  const autoBook = preview.data?.bookValue ?? null;
  const bookValue = autoBook ?? amountOf(manualBook) ?? null;
  const saleAmount = amountOf(amount);
  const profitLoss =
    isSale && saleAmount !== undefined && bookValue !== null
      ? Math.round((saleAmount - bookValue) * 100) / 100
      : null;

  const errors = {
    date: !date
      ? 'Enter the date.'
      : date > todayIso()
      ? 'The date cannot be in the future.'
      : preview.data?.purchaseDate && date < preview.data.purchaseDate
      ? `It was bought on ${preview.data.purchaseDate}.`
      : undefined,
    scrapReason: !isSale && !scrapReason ? 'Choose a reason.' : undefined,
    party: isSale && !party.trim() ? 'Enter the buyer’s name.' : undefined,
    amount: isSale
      ? saleAmount === undefined
        ? 'Enter the sale amount.'
        : !(saleAmount >= 0)
        ? 'Enter an amount.'
        : undefined
      : amount.trim() && !(Number(amount) >= 0)
      ? 'Enter an amount.'
      : undefined,
    book:
      isSale && autoBook === null && amountOf(manualBook) === undefined
        ? 'No depreciation is on record for this machine — enter its book value.'
        : undefined,
    approvedBy: !approvedBy.trim() ? 'Enter who approved it.' : undefined,
    file: file && file.size > MAX_BYTES ? 'The file is over 10 MB.' : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = useMutation({
    mutationFn: async () => {
      const input: DisposeInput = {
        type,
        disposalDate: date,
        approvedBy: approvedBy.trim(),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
        ...(party.trim() ? { counterpartyName: party.trim() } : {}),
        ...(amountOf(amount) !== undefined ? { valueRealised: Number(amount) } : {}),
        ...(isSale
          ? {
              ...(contact.trim() ? { buyerContact: contact.trim() } : {}),
              ...(paymentMode ? { paymentMode } : {}),
              ...(invoice.trim() ? { invoiceNumber: invoice.trim() } : {}),
              ...(autoBook === null && amountOf(manualBook) !== undefined
                ? { bookValue: Number(manualBook) }
                : {}),
            }
          : { scrapReason }),
        ...(file
          ? {
              attachment: await toBase64(file),
              attachmentName: file.name,
              attachmentMime: file.type || 'application/octet-stream',
            }
          : {}),
      };
      return disposeEquipment(equipment.id, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onDone();
    },
    onError: (e) => {
      setStep('form');
      setError(e instanceof ApiError ? e.message : 'Could not save the disposal.');
    },
  });

  const title = `${isSale ? 'Mark as Sold' : 'Mark as Scrapped'} — ${equipment.code}`;

  if (step === 'confirm') {
    return (
      <Modal
        title="Confirm disposal"
        onClose={onClose}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setStep('form')} disabled={save.isPending}>
              Back
            </SecondaryButton>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-500 disabled:opacity-50 sm:h-10"
            >
              {save.isPending
                ? 'Saving…'
                : isSale
                ? 'Yes, mark as sold'
                : 'Yes, mark as scrapped'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-gray-800">
          <p>
            <span className="font-semibold">
              {equipment.code} · {equipment.name}
            </span>{' '}
            will be marked as <span className="font-semibold">{isSale ? 'Sold' : 'Scrapped'}</span>{' '}
            on {date}.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            <li>It leaves the active machine list, site and project pickers, service schedules and utilisation reports.</li>
            <li>No new logbook, fuel, maintenance or service entries can be made against it.</li>
            <li>Its history and past records stay, and a Super Admin can reverse this if it was a mistake.</li>
          </ul>
          {preview.data?.deployedSiteName && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900" role="alert">
              <ExclamationTriangleIcon className="mt-0.5 w-5 flex-none" aria-hidden="true" />
              This machine is deployed at {preview.data.deployedSiteName}. Disposing will release it
              from that site.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-gray-50 p-3">
            {isSale ? (
              <>
                <dt className="text-gray-600">Buyer</dt>
                <dd>{party}</dd>
                <dt className="text-gray-600">Sale amount</dt>
                <dd>{formatRupees(saleAmount ?? 0)}</dd>
                <dt className="text-gray-600">Book value</dt>
                <dd>{bookValue === null ? '—' : formatRupees(bookValue)}</dd>
                <dt className="text-gray-600">Profit / loss</dt>
                <dd className={clsx((profitLoss ?? 0) < 0 ? 'text-red-700' : 'text-green-700')}>
                  {profitLoss === null ? '—' : formatRupees(profitLoss)}
                </dd>
              </>
            ) : (
              <>
                <dt className="text-gray-600">Reason</dt>
                <dd>{SCRAP_REASON_LABELS[scrapReason]}</dd>
                <dt className="text-gray-600">Scrap value</dt>
                <dd>{saleAmount === undefined ? '—' : formatRupees(saleAmount)}</dd>
              </>
            )}
            <dt className="text-gray-600">Approved by</dt>
            <dd>{approvedBy}</dd>
          </dl>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setTouched(true);
              setError(null);
              if (valid) setStep('confirm');
            }}
          >
            Continue
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <div role="radiogroup" aria-label="Disposal type" className="grid grid-cols-2 gap-2">
          {(['scrapped', 'sold'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={clsx(
                'h-11 rounded-lg border text-sm font-medium',
                type === t
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-gray-300 bg-white text-gray-700',
              )}
            >
              {t === 'sold' ? 'Mark as Sold' : 'Mark as Scrapped'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            id="dsp-date"
            label={isSale ? 'Sale date' : 'Scrap date'}
            type="date"
            max={todayIso()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={touched ? errors.date : undefined}
          />
          {isSale ? (
            <TextField
              id="dsp-amount"
              label="Sale amount (₹)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={touched ? errors.amount : undefined}
            />
          ) : (
            <SelectField
              id="dsp-reason"
              label="Reason"
              value={scrapReason}
              onChange={(e) => setScrapReason(e.target.value)}
              error={touched ? errors.scrapReason : undefined}
            >
              <option value="">Choose…</option>
              {SCRAP_REASONS.map((r) => (
                <option key={r} value={r}>
                  {SCRAP_REASON_LABELS[r]}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            id="dsp-party"
            label={isSale ? 'Buyer name' : 'Scrap vendor / buyer (optional)'}
            maxLength={200}
            value={party}
            onChange={(e) => setParty(e.target.value)}
            error={touched ? errors.party : undefined}
          />
          {isSale ? (
            <TextField
              id="dsp-contact"
              label="Buyer contact (optional)"
              maxLength={120}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          ) : (
            <TextField
              id="dsp-scrap-value"
              label="Scrap value realised (₹, optional)"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={touched ? errors.amount : undefined}
            />
          )}

          {isSale && (
            <>
              <SelectField
                id="dsp-mode"
                label="Payment mode (optional)"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="">Choose…</option>
                {DISPOSAL_PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {DISPOSAL_PAYMENT_MODE_LABELS[m]}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="dsp-invoice"
                label="Invoice number (optional)"
                maxLength={80}
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
              />
              {autoBook !== null ? (
                <div>
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Book value on sale date
                  </span>
                  <p className="min-h-10 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {formatRupees(autoBook)}
                    <span className="ml-1 text-xs text-gray-500">from depreciation</span>
                  </p>
                </div>
              ) : (
                <TextField
                  id="dsp-book"
                  label="Book value on sale date (₹)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={manualBook}
                  onChange={(e) => setManualBook(e.target.value)}
                  error={touched ? errors.book : undefined}
                  hint="This machine has no depreciation on record."
                />
              )}
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Profit / loss on sale
                </span>
                <p
                  className={clsx(
                    'min-h-10 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium',
                    profitLoss === null
                      ? 'text-gray-400'
                      : profitLoss < 0
                      ? 'text-red-700'
                      : 'text-green-700',
                  )}
                  aria-live="polite"
                >
                  {profitLoss === null ? 'Sale amount − book value' : formatRupees(profitLoss)}
                </p>
              </div>
            </>
          )}

          <TextField
            id="dsp-approved"
            label="Approved by"
            maxLength={120}
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value)}
            error={touched ? errors.approvedBy : undefined}
          />
          <div>
            <label htmlFor="dsp-file" className="mb-1 block text-sm font-medium text-gray-700">
              {isSale ? 'Invoice / agreement (optional)' : 'Photo / document (optional)'}
            </label>
            <input
              id="dsp-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2"
            />
            {touched && errors.file && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {errors.file}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="dsp-remarks" className="mb-1 block text-sm font-medium text-gray-700">
            Remarks (optional)
          </label>
          <textarea
            id="dsp-remarks"
            rows={2}
            maxLength={2000}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {preview.data?.deployedSiteName && (
          <p className="text-xs text-amber-800">
            Deployed at {preview.data.deployedSiteName} — disposing will release it from that site.
          </p>
        )}
      </div>
    </Modal>
  );
}

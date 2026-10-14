'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  PAYMENT_MODES,
  type Payee,
  type PayeeBank,
  type PaymentMode,
  downloadPaymentAdvice,
  getPayee,
  instrumentFor,
  recordBillPayment,
  setPayeeBank,
} from '@/app/lib/api/billing';
import { saveBlob } from '@/app/lib/download-file';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { FileIcon } from '@/app/ui/file-icons';

/**
 * Generating a payment advice for a certified subcontractor bill (2026-10-13).
 *
 * Asks for what only exists once the money has moved — the date, the amount, the mode and the
 * bank's reference — and reads everything else: the vendor's code, name and bank details from
 * their record, the company's name, logo and address from Settings. Saving records the payment
 * against the bill and downloads the advice in one step.
 *
 * **The vendor's bank details are shown before anything is paid**, and any the record lacks can be
 * filled in here. They are written to the vendor record, so the next advice to the same vendor
 * has them too.
 */
export default function PaymentAdviceDialog({
  raBillId,
  billNumber,
  outstanding,
  onClose,
  onDone,
}: {
  raBillId: string;
  billNumber: string;
  /** Prefills the amount: paying the balance is the usual case. */
  outstanding: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const payee = useQuery({
    queryKey: ['raBillPayee', raBillId],
    queryFn: () => getPayee(raBillId),
  });

  const [paidOn, setPaidOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState(
    outstanding && outstanding > 0 ? outstanding.toFixed(2) : '',
  );
  const [mode, setMode] = useState<PaymentMode>('NEFT');
  const [reference, setReference] = useState('');
  const [particulars, setParticulars] = useState('');
  const [tdsAmount, setTdsAmount] = useState('');
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingBank = (payee.data?.missing.length ?? 0) > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await recordBillPayment(raBillId, {
        paidOn,
        amount: amount.trim(),
        instrument: instrumentFor(mode),
        mode,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(particulars.trim() ? { particulars: particulars.trim() } : {}),
        ...(tdsAmount.trim() ? { tdsAmount: tdsAmount.trim() } : {}),
      });
      if (result.recordedPaymentId) {
        const { blob, filename } = await downloadPaymentAdvice(
          result.recordedPaymentId,
          format,
        );
        saveBlob(blob, filename);
      }
      onDone();
      onClose();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Generate payment advice — ${billNumber}`}
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="payment-advice-form"
            disabled={busy || !amount.trim() || !paidOn}
          >
            {busy ? 'Generating…' : 'Record payment & download advice'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <PayeePanel
          raBillId={raBillId}
          payee={payee.data}
          loading={payee.isLoading}
          onSaved={(next) =>
            queryClient.setQueryData(['raBillPayee', raBillId], next)
          }
        />

        <form
          id="payment-advice-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextField
            id="advice-date"
            label="Transaction date"
            type="date"
            required
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
          <TextField
            id="advice-amount"
            label="Amount (₹)"
            inputMode="decimal"
            required
            hint="Prefilled with what is outstanding on this bill."
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label
              htmlFor="advice-mode"
              className="text-sm font-medium text-gray-700"
            >
              Bank transaction mode
            </label>
            <select
              id="advice-mode"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
            >
              {PAYMENT_MODES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <TextField
            id="advice-reference"
            label={
              mode === 'Cheque' ? 'Cheque number' : 'Bank reference no. (UTR)'
            }
            hint="As the bank's confirmation shows it."
            maxLength={120}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <TextField
            id="advice-particulars"
            label="Particulars"
            hint={`Payment voucher no., e.g. 10/2026-27. Left blank, the advice says ${billNumber}.`}
            maxLength={120}
            value={particulars}
            onChange={(e) => setParticulars(e.target.value)}
          />
          <TextField
            id="advice-tds"
            label="TDS amount (₹)"
            inputMode="decimal"
            hint="Deducted at source on this payment, if any."
            value={tdsAmount}
            onChange={(e) => setTdsAmount(e.target.value)}
          />
          <fieldset className="flex items-center gap-4 text-sm sm:col-span-2">
            <legend className="sr-only">Download as</legend>
            <span className="font-medium text-gray-700">Download as</span>
            {(['pdf', 'docx'] as const).map((option) => (
              <label key={option} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="advice-format"
                  checked={format === option}
                  onChange={() => setFormat(option)}
                />
                <FileIcon kind={option === 'pdf' ? 'pdf' : 'word'} />
                {option === 'pdf' ? 'PDF' : 'Word'}
              </label>
            ))}
          </fieldset>
        </form>

        {missingBank && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            The vendor’s bank details are incomplete, so the advice would print
            those fields blank. Fill them in above first.
          </p>
        )}
        <FormError message={error} />
      </div>
    </Modal>
  );
}

const BANK_FIELDS: { key: keyof PayeeBank; label: string; hint?: string }[] = [
  { key: 'bankName', label: 'Bank name' },
  { key: 'bankBranch', label: 'Branch' },
  { key: 'bankAccountNumber', label: 'Account number' },
  { key: 'ifscCode', label: 'IFSC code', hint: 'e.g. BARB0DEOLIX' },
  { key: 'bankAccountHolderName', label: 'Account holder name' },
];

function PayeePanel({
  raBillId,
  payee,
  loading,
  onSaved,
}: {
  raBillId: string;
  payee: Payee | undefined;
  loading: boolean;
  onSaved: (payee: Payee) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PayeeBank>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Reading the vendor’s details…</p>
    );
  }
  if (!payee) return null;
  if (!payee.vendorId) {
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
        This bill’s work order names no subcontractor, so there is nobody to
        address the advice to. Set the subcontractor on the work order first.
      </p>
    );
  }

  const open = editing || payee.missing.length > 0;

  return (
    <section className="rounded-md border border-gray-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Paid to {payee.name}
          {payee.code ? (
            <span className="ml-2 font-normal text-gray-500">
              Vendor code {payee.code}
            </span>
          ) : null}
        </h3>
        {!open && (
          <button
            type="button"
            className="text-xs font-medium text-blue-700 underline"
            onClick={() => {
              setDraft({});
              setEditing(true);
            }}
          >
            Edit bank details
          </button>
        )}
      </div>

      {!open ? (
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {BANK_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex gap-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-gray-900">{payee[key] ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form
          className="mt-2 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              const next = await setPayeeBank(raBillId, draft);
              onSaved(next);
              setEditing(false);
              setDraft({});
            } catch (err) {
              setError(describe(err));
            } finally {
              setSaving(false);
            }
          }}
        >
          {payee.missing.length > 0 && (
            <p className="text-sm text-amber-900 sm:col-span-2">
              Missing from the vendor record — saved there, so the next advice
              has them too.
            </p>
          )}
          {BANK_FIELDS.map(({ key, label, hint }) => (
            <TextField
              key={key}
              id={`payee-${key}`}
              label={label}
              hint={hint}
              value={draft[key] ?? payee[key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={saving || Object.keys(draft).length === 0}
            >
              {saving ? 'Saving…' : 'Save bank details'}
            </Button>
            {editing && payee.missing.length === 0 && (
              <SecondaryButton type="button" onClick={() => setEditing(false)}>
                Cancel
              </SecondaryButton>
            )}
          </div>
          <div className="sm:col-span-2">
            <FormError message={error} />
          </div>
        </form>
      )}
    </section>
  );
}

function describe(err: unknown): string {
  const anyErr = err as {
    message?: string;
    details?: { message?: string | string[] };
  };
  const detail = anyErr?.details?.message;
  return (
    (Array.isArray(detail) ? detail.join('; ') : detail) ??
    anyErr?.message ??
    'The request was refused and the server gave no reason.'
  );
}

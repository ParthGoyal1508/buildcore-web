'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  PAYMENT_INSTRUMENTS,
  type PaymentInstrument,
  type RaBill,
  downloadSignedCopy,
  getBillOutstanding,
  getBillSignedCopies,
  recordBillPayment,
  removeBillPayment,
  uploadBillSignedCopy,
} from '@/app/lib/api/billing';
import { saveBlob } from '@/app/lib/api/hr-payroll';
import { SETTLEMENT_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import HiddenAmount from '@/app/ui/hidden-amount';

/**
 * What has been paid against one bill, and whether the signed copy came back (028 FR-020, FR-021).
 *
 * ## Why this is a panel of its own rather than part of `RaBillView`
 *
 * `RaBillView` fetches nothing, deliberately: every figure it shows is already on the bill the list
 * carried, so a detail request there would be a second chance for two renderings of one bill to
 * disagree. Payments and signed copies are **different data**, and they change without the bill
 * changing — so they are read here, beside it, rather than by making that component fetch.
 *
 * ## Outstanding is never computed in this file
 *
 * The server derives it as certified less paid and nothing stores it. Adding the payments up here
 * would be a second derivation, free to disagree with the first — and the first is the one a
 * subcontractor is told. So the figure is rendered exactly as it arrives.
 *
 * ## An uncertified bill shows the reason, not a form
 *
 * The server refuses a payment against a draft, and a form that submits into a refusal is a form
 * that wastes somebody's typing. The sentence says what to do instead: money paid before
 * certification is an advance, recovered through the package's adjustments.
 *
 * ## A cash amount may be hidden, and that is not a bug
 *
 * `instrument` joined the cash surface list with this feature, so a cash payment's amount arrives
 * as `null` with `amountHidden` beside it for a caller without Cash Entry. Rendered as a stated
 * absence through `HiddenAmount` — never as a blank and never as a zero, because a zero is a figure
 * nothing downstream can tell from a real one.
 */
export default function RaBillSettlement({ bill }: { bill: RaBill }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const certified = bill.status === 'approved';

  const outstanding = useQuery({
    queryKey: ['raBillOutstanding', bill.id],
    queryFn: () => getBillOutstanding(bill.id),
    enabled: certified,
  });

  const copies = useQuery({
    queryKey: ['raBillSignedCopies', bill.id],
    queryFn: () => getBillSignedCopies(bill.id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['raBillOutstanding', bill.id],
    });
    void queryClient.invalidateQueries({
      queryKey: ['raBillSignedCopies', bill.id],
    });
    // The bill's own row carries `acknowledgedOn`, which a filed copy has just changed.
    void queryClient.invalidateQueries({ queryKey: ['raBills'] });
  };

  if (!certified) {
    return (
      <section className="mt-3 border-t border-gray-100 pt-3">
        <h4 className="text-sm font-semibold text-gray-900">
          {SETTLEMENT_COPY.heading}
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          {SETTLEMENT_COPY.notCertified}
        </p>
      </section>
    );
  }

  const position = outstanding.data;

  return (
    <section className="mt-3 space-y-4 border-t border-gray-100 pt-3">
      <h4 className="text-sm font-semibold text-gray-900">
        {SETTLEMENT_COPY.heading}
      </h4>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {position && (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.certified}
            </dt>
            <dd className="tabular-nums">
              {rupees(position.certifiedAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.paid}
            </dt>
            <dd className="tabular-nums">{rupees(position.paidAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {SETTLEMENT_COPY.outstanding}
            </dt>
            {/* Exactly as the server derived it. Adding the payments up here would be a second
                derivation of the same figure, and the server's is the one the subcontractor is
                told. */}
            <dd className="font-medium tabular-nums">
              {position.outstandingAmount === 0
                ? SETTLEMENT_COPY.settled
                : rupees(position.outstandingAmount)}
            </dd>
            <dd className="mt-0.5 text-xs text-gray-500">
              {SETTLEMENT_COPY.outstandingHint}
            </dd>
          </div>
        </dl>
      )}

      <Payments
        bill={bill}
        payments={position?.payments ?? []}
        onError={setError}
        onChanged={refresh}
      />

      <SignedCopies
        billId={bill.id}
        acknowledgedOn={position?.acknowledgedOn ?? null}
        copies={copies.data ?? []}
        onError={setError}
        onChanged={refresh}
      />
    </section>
  );
}

function Payments({
  bill,
  payments,
  onError,
  onChanged,
}: {
  bill: RaBill;
  payments: {
    id: string;
    paidOn: string;
    amount: number | null;
    amountHidden?: boolean;
    instrument: PaymentInstrument;
    reference: string | null;
    remarks: string | null;
  }[];
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [paidOn, setPaidOn] = useState('');
  const [amount, setAmount] = useState('');
  const [instrument, setInstrument] =
    useState<PaymentInstrument>('bank_transfer');
  const [reference, setReference] = useState('');

  const record = useMutation({
    mutationFn: () =>
      recordBillPayment(bill.id, {
        paidOn,
        // Sent as the string that was typed. Parsing it to a number here is where the paisa goes.
        amount,
        instrument,
        ...(reference ? { reference } : {}),
      }),
    onSuccess: () => {
      onError(null);
      setAmount('');
      setReference('');
      onChanged();
    },
    onError: (err: unknown) => onError(describe(err)),
  });

  const remove = useMutation({
    mutationFn: (paymentId: string) => removeBillPayment(paymentId),
    onSuccess: () => {
      onError(null);
      onChanged();
    },
    onError: (err: unknown) => onError(describe(err)),
  });

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {SETTLEMENT_COPY.paymentsHeading}
      </h5>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-600">{SETTLEMENT_COPY.paymentsNone}</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-2 py-1.5"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">
                  {/* A hidden cash amount is a stated absence, never a blank and never a zero. */}
                  {payment.amountHidden ? (
                    <HiddenAmount />
                  ) : (
                    rupees(payment.amount)
                  )}
                </span>
                <span className="text-gray-600">
                  {dateLabel(payment.paidOn)} ·{' '}
                  {SETTLEMENT_COPY.instrumentLabels[payment.instrument] ??
                    payment.instrument}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
              </span>
              <Button
                type="button"
                intent="write"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(SETTLEMENT_COPY.removeConfirm)) {
                    remove.mutate(payment.id);
                  }
                }}
              >
                {SETTLEMENT_COPY.remove}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/*
        The action sits below the fields rather than as a fifth column of them.
        As a column it was a fifth of the width, which wrapped its label; and `self-end` aligned it
        to the bottom of the tallest cell — the reference field, which carries a hint — so it
        floated a line below the inputs it belongs to. Four fields, then the button.
      */}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          record.mutate();
        }}
      >
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.paidOnLabel}
            </span>
            <input
              type="date"
              required
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.amountLabel}
            </span>
            <input
              // `inputMode` rather than `type="number"`: a number input rounds what it hands back on
              // some browsers, and the one thing this field must not do is change the figure.
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 tabular-nums"
              placeholder="600000.00"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.instrumentLabel}
            </span>
            <select
              value={instrument}
              onChange={(event) =>
                setInstrument(event.target.value as PaymentInstrument)
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              {PAYMENT_INSTRUMENTS.map((option) => (
                <option key={option} value={option}>
                  {SETTLEMENT_COPY.instrumentLabels[option] ?? option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.referenceLabel}
            </span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
              placeholder="UTR 316902847561"
            />
            <span className="text-xs text-gray-500">
              {SETTLEMENT_COPY.referenceHint}
            </span>
          </label>
        </div>

        <div>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending
              ? SETTLEMENT_COPY.recording
              : SETTLEMENT_COPY.record}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SignedCopies({
  billId,
  acknowledgedOn,
  copies,
  onError,
  onChanged,
}: {
  billId: string;
  acknowledgedOn: string | null;
  copies: { id: string; fileName: string; receivedOn: string }[];
  onError: (message: string | null) => void;
  onChanged: () => void;
}) {
  const [receivedOn, setReceivedOn] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const data = await base64Of(file);
      await uploadBillSignedCopy(billId, {
        data,
        fileName: file.name,
        receivedOn,
      });
    },
    onSuccess: () => {
      onError(null);
      setFile(null);
      setReceivedOn('');
      onChanged();
    },
    onError: (err: unknown) => onError(describe(err)),
  });

  const download = useMutation({
    mutationFn: async (copy: { id: string; fileName: string }) => {
      const { blob, filename } = await downloadSignedCopy(
        copy.id,
        copy.fileName,
      );
      saveBlob(blob, filename);
    },
    onError: (err: unknown) => onError(describe(err)),
  });

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {SETTLEMENT_COPY.signedHeading}
      </h5>

      {/* **The state, not the file.** FR-020 exists because a file in a list cannot answer "which
          bills are unacknowledged", and this line is the answer. */}
      <p className="text-sm">
        {acknowledgedOn ? (
          <span className="font-medium text-green-800">
            {SETTLEMENT_COPY.acknowledged(dateLabel(acknowledgedOn))}
          </span>
        ) : (
          <span className="text-gray-600">
            {SETTLEMENT_COPY.unacknowledged}
          </span>
        )}
      </p>

      {copies.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {copies.map((copy) => (
            <li
              key={copy.id}
              className="flex flex-wrap items-center justify-between gap-2 py-1.5"
            >
              <span className="text-gray-700">
                {copy.fileName}
                <span className="ml-2 text-xs text-gray-500">
                  {dateLabel(copy.receivedOn)}
                </span>
              </span>
              <Button
                type="button"
                disabled={download.isPending}
                onClick={() => download.mutate(copy)}
              >
                {SETTLEMENT_COPY.download}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          upload.mutate();
        }}
      >
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.receivedOnLabel}
            </span>
            <input
              type="date"
              required
              value={receivedOn}
              onChange={(event) => setReceivedOn(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <span className="text-xs text-gray-500">
              {SETTLEMENT_COPY.receivedOnHint}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              {SETTLEMENT_COPY.fileLabel}
            </span>
            <input
              type="file"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-500">
              {SETTLEMENT_COPY.replaceHint}
            </span>
          </label>
        </div>

        <div>
          <Button type="submit" disabled={upload.isPending || !file}>
            {upload.isPending
              ? SETTLEMENT_COPY.uploading
              : SETTLEMENT_COPY.upload}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** The file's bytes, base64-encoded, the shape every upload in this product takes. */
async function base64Of(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked rather than one spread: `String.fromCharCode(...bytes)` on a multi-megabyte scan
  // exceeds the argument limit and throws, which would make a large signed copy unuploadable.
  const CHUNK = 8192;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  // Every refusal here names its own condition and says what to do — an uncertified bill, a
  // payment past what was certified. Passing the server's sentence through is the whole value of
  // having written them.
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'That could not be recorded and the server gave no reason.'
  );
}

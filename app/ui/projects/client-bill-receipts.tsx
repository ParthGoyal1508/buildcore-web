'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import {
  clientHoldingKeys,
  getBillReceipts,
  PAYMENT_INSTRUMENTS,
  recordBillReceipt,
  removeBillReceipt,
  type ClientBillReceipts as Position,
  type PaymentInstrument,
} from '@/app/lib/api/client-holdings';
import { CLIENT_HOLDINGS_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { projectErrorMessage } from '@/app/ui/projects/project-lock-context';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { TABLE } from '@/app/ui/table';
import { useToast } from '@/app/ui/toast';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Money the client paid against this bill, and what it held back (048).
 *
 * The bill's value, what is settled and what is outstanding sit above the receipts, so the one
 * question a project manager asks — "what is the client still to pay us" — is answered without a
 * sum. Retention and CPBG withheld are shown per receipt because they are our money the client is
 * holding; the project's overview totals them.
 */
export default function ClientBillReceipts({
  billId,
  projectId,
  isDraft,
  isLocked,
}: {
  billId: string;
  projectId: string;
  /** A draft cannot take receipts — the server refuses, and the control is not offered. */
  isDraft: boolean;
  isLocked: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isError } = useQuery({
    queryKey: clientHoldingKeys.bill(billId),
    queryFn: () => getBillReceipts(billId),
  });

  const refresh = (position?: Position) => {
    if (position) queryClient.setQueryData(clientHoldingKeys.bill(billId), position);
    void queryClient.invalidateQueries({
      queryKey: clientHoldingKeys.project(projectId),
    });
  };

  const remove = useMutation({
    mutationFn: (receiptId: string) => removeBillReceipt(billId, receiptId),
    onSuccess: (position) => {
      refresh(position);
      setError(null);
      toast.success(CLIENT_HOLDINGS_COPY.receiptRemoved);
    },
    onError: (err: Error) => setError(projectErrorMessage(err)),
  });

  if (isError) {
    return <FormError message={CLIENT_HOLDINGS_COPY.loadFailed} />;
  }
  if (!data) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {CLIENT_HOLDINGS_COPY.receiptsHeading}
      </h3>
      <dl className="grid max-w-xl grid-cols-3 gap-2 rounded border border-gray-200 p-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500">
            {CLIENT_HOLDINGS_COPY.billValue}
          </dt>
          <dd className="tabular-nums text-gray-900">{rupees(data.billValue)}</dd>
          <dd className="text-xs text-gray-500">
            {CLIENT_HOLDINGS_COPY.basis[data.billValueBasis]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{CLIENT_HOLDINGS_COPY.settled}</dt>
          <dd className="tabular-nums text-gray-900">{rupees(data.settled)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">
            {CLIENT_HOLDINGS_COPY.outstanding}
          </dt>
          <dd
            className={clsx(
              'tabular-nums font-semibold',
              data.outstanding > 0 ? 'text-amber-800' : 'text-green-800',
            )}
          >
            {rupees(data.outstanding)}
          </dd>
        </div>
      </dl>

      <FormError message={error} />

      {data.receipts.length === 0 ? (
        <p className="text-sm text-gray-600">{CLIENT_HOLDINGS_COPY.noReceipts}</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={clsx(TABLE.table, 'w-full')}>
            <thead className={TABLE.thead}>
              <tr>
                <th scope="col" className={TABLE.th}>
                  {CLIENT_HOLDINGS_COPY.receivedOn}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.received}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.retention}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.cpbg}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.tds}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.other}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {CLIENT_HOLDINGS_COPY.settles}
                </th>
                {!isLocked && <th scope="col" className={TABLE.th} />}
              </tr>
            </thead>
            <tbody>
              {data.receipts.map((receipt) => (
                <tr key={receipt.id} className={TABLE.row}>
                  <td className={clsx(TABLE.td, 'whitespace-nowrap')}>
                    {dateLabel(receipt.receivedOn)}
                    <span className="block text-xs text-gray-500">
                      {CLIENT_HOLDINGS_COPY.instrument[
                        receipt.instrument as PaymentInstrument
                      ] ?? receipt.instrument}
                      {receipt.reference ? ` · ${receipt.reference}` : ''}
                    </span>
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(receipt.amount)}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(receipt.retentionAmount)}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(receipt.cpbgAmount)}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(receipt.tdsAmount)}
                  </td>
                  <td
                    className={clsx(TABLE.td, TABLE.numeric)}
                    title={receipt.otherDeductionNote ?? undefined}
                  >
                    {rupees(receipt.otherDeduction)}
                  </td>
                  <td className={clsx(TABLE.td, TABLE.numeric, 'font-medium')}>
                    {rupees(receipt.settles)}
                  </td>
                  {!isLocked && (
                    <td className={TABLE.td}>
                      <RowAction
                        onClick={async () => {
                          if (
                            await confirmDialog({
                              title: CLIENT_HOLDINGS_COPY.removeTitle,
                              message: CLIENT_HOLDINGS_COPY.removeMessage(
                                rupees(receipt.settles),
                              ),
                              confirmLabel: 'Remove',
                              tone: 'danger',
                            })
                          )
                            remove.mutate(receipt.id);
                        }}
                      >
                        Remove
                      </RowAction>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLocked && !isDraft && data.outstanding > 0 && (
        <SecondaryButton type="button" onClick={() => setRecording(true)}>
          {CLIENT_HOLDINGS_COPY.recordReceipt}
        </SecondaryButton>
      )}
      {isDraft && (
        <p className="text-xs text-gray-500">{CLIENT_HOLDINGS_COPY.draftHint}</p>
      )}

      {recording && (
        <ReceiptModal
          billId={billId}
          position={data}
          onClose={() => setRecording(false)}
          onSaved={(position) => {
            refresh(position);
            setRecording(false);
            toast.success(CLIENT_HOLDINGS_COPY.receiptRecorded);
          }}
        />
      )}
    </section>
  );
}

/** Two decimals at most, nothing else — what the API stores. */
const MONEY_PATTERN = /^\d+(\.\d{0,2})?$/;

function ReceiptModal({
  billId,
  position,
  onClose,
  onSaved,
}: {
  billId: string;
  position: Position;
  onClose: () => void;
  onSaved: (position: Position) => void;
}) {
  const [receivedOn, setReceivedOn] = useState(today());
  // Pre-filled with what the terms suggest; the receipt records what the client actually did.
  const [amount, setAmount] = useState('');
  const [retention, setRetention] = useState(
    position.suggested.retentionAmount ? String(position.suggested.retentionAmount) : '',
  );
  const [cpbg, setCpbg] = useState(
    position.suggested.cpbgAmount ? String(position.suggested.cpbgAmount) : '',
  );
  const [tds, setTds] = useState('');
  const [other, setOther] = useState('');
  const [otherNote, setOtherNote] = useState('');
  const [instrument, setInstrument] = useState<PaymentInstrument>('bank_transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fields = { amount, retention, cpbg, tds, other };
  const invalid = Object.entries(fields).filter(
    ([, value]) => value.trim() !== '' && !MONEY_PATTERN.test(value.trim()),
  );
  const num = (value: string) => (value.trim() ? Number(value) : 0);
  const settles =
    num(amount) + num(retention) + num(cpbg) + num(tds) + num(other);
  const over = settles - position.outstanding > 0.004;

  const save = useMutation({
    mutationFn: () =>
      recordBillReceipt(billId, {
        receivedOn,
        amount: num(amount),
        retentionAmount: num(retention),
        cpbgAmount: num(cpbg),
        tdsAmount: num(tds),
        otherDeduction: num(other),
        ...(otherNote.trim() ? { otherDeductionNote: otherNote.trim() } : {}),
        instrument,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      }),
    onSuccess: (result) => onSaved(result.position),
    onError: (err: Error) => setError(projectErrorMessage(err)),
  });

  const fieldError = (key: keyof typeof fields) =>
    invalid.some(([k]) => k === key) ? CLIENT_HOLDINGS_COPY.moneyInvalid : undefined;

  return (
    <Modal
      title={CLIENT_HOLDINGS_COPY.recordReceiptTitle(position.billNumber)}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            loading={save.isPending}
            disabled={
              save.isPending ||
              invalid.length > 0 ||
              settles <= 0 ||
              over ||
              !receivedOn
            }
            onClick={() => save.mutate()}
          >
            {CLIENT_HOLDINGS_COPY.saveReceipt}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          {CLIENT_HOLDINGS_COPY.outstandingNow(rupees(position.outstanding))}
        </p>
        <TextField
          id="receipt-date"
          type="date"
          label={CLIENT_HOLDINGS_COPY.receivedOn}
          value={receivedOn}
          max={today()}
          onChange={(event) => setReceivedOn(event.target.value)}
        />
        <TextField
          id="receipt-amount"
          label={CLIENT_HOLDINGS_COPY.amountLabel}
          hint={CLIENT_HOLDINGS_COPY.amountHint}
          inputMode="decimal"
          value={amount}
          error={fieldError('amount')}
          onChange={(event) => setAmount(event.target.value)}
        />
        <TextField
          id="receipt-retention"
          label={CLIENT_HOLDINGS_COPY.retentionLabel}
          hint={CLIENT_HOLDINGS_COPY.retentionHint}
          inputMode="decimal"
          value={retention}
          error={fieldError('retention')}
          onChange={(event) => setRetention(event.target.value)}
        />
        <TextField
          id="receipt-cpbg"
          label={CLIENT_HOLDINGS_COPY.cpbgLabel}
          hint={
            position.pbgRunning
              ? CLIENT_HOLDINGS_COPY.cpbgPbgRunning
              : CLIENT_HOLDINGS_COPY.cpbgHint
          }
          inputMode="decimal"
          value={cpbg}
          error={fieldError('cpbg')}
          onChange={(event) => setCpbg(event.target.value)}
        />
        <TextField
          id="receipt-tds"
          label={CLIENT_HOLDINGS_COPY.tdsLabel}
          inputMode="decimal"
          value={tds}
          error={fieldError('tds')}
          onChange={(event) => setTds(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="receipt-other"
            label={CLIENT_HOLDINGS_COPY.otherLabel}
            inputMode="decimal"
            value={other}
            error={fieldError('other')}
            onChange={(event) => setOther(event.target.value)}
          />
          <TextField
            id="receipt-other-note"
            label={CLIENT_HOLDINGS_COPY.otherNoteLabel}
            value={otherNote}
            onChange={(event) => setOtherNote(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="receipt-instrument"
            label={CLIENT_HOLDINGS_COPY.instrumentLabel}
            value={instrument}
            onChange={(event) =>
              setInstrument(event.target.value as PaymentInstrument)
            }
          >
            {PAYMENT_INSTRUMENTS.map((value) => (
              <option key={value} value={value}>
                {CLIENT_HOLDINGS_COPY.instrument[value]}
              </option>
            ))}
          </SelectField>
          <TextField
            id="receipt-reference"
            label={CLIENT_HOLDINGS_COPY.referenceLabel}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
        <p
          className={clsx(
            'rounded px-3 py-2 text-sm',
            over ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700',
          )}
        >
          {over
            ? CLIENT_HOLDINGS_COPY.overOutstanding(
                rupees(settles),
                rupees(position.outstanding),
              )
            : CLIENT_HOLDINGS_COPY.settlesSummary(rupees(settles))}
        </p>
        <FormError message={error} />
      </div>
    </Modal>
  );
}

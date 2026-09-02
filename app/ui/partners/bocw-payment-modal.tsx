'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { recordBocwPayment } from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { Field, TextArea, TextInput } from '@/app/ui/partners/form-controls';

export default function BocwPaymentModal({
  projectId,
  projectName,
  balance,
  onClose,
}: {
  projectId: string;
  projectName: string;
  balance: number;
  onClose: () => void;
}) {
  const [amountPaid, setAmountPaid] = useState(String(balance > 0 ? balance : ''));
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      recordBocwPayment(projectId, {
        amountPaid: Number(amountPaid),
        paymentDate,
        referenceNumber: referenceNumber.trim(),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', 'bocw'] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  return (
    <Modal
      title={`Record cess payment — ${projectName}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="bocw-payment-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Record payment'}
          </Button>
        </>
      }
    >
      <form
        id="bocw-payment-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!(Number(amountPaid) > 0)) {
            return setError('Enter an amount greater than zero.');
          }
          if (!referenceNumber.trim()) {
            return setError('A challan or transfer reference is required.');
          }
          mutation.mutate();
        }}
      >
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field
          id="bocw-amount"
          label="Amount paid"
          hint="Pre-filled with the outstanding balance; change it for a part payment."
        >
          <TextInput
            id="bocw-amount"
            type="number"
            step="0.01"
            min="0"
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
          />
        </Field>
        <Field id="bocw-date" label="Payment date">
          <TextInput
            id="bocw-date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
        </Field>
        <Field
          id="bocw-reference"
          label="Reference"
          hint="Challan or transfer reference — the only record that the money moved."
        >
          <TextInput
            id="bocw-reference"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
          />
        </Field>
        <Field id="bocw-remarks" label="Remarks">
          <TextArea
            id="bocw-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

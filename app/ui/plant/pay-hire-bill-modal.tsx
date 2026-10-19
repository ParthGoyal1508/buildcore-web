'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { payHireBill } from '@/app/lib/api/plant';
import type { HireBillFull } from '@/app/lib/api/plant-hire';
import { rupees, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * Mark a verified hire bill paid (036 K8): the payment date, defaulting to today in India time,
 * and the reference. Payment used to be stamped with the server's UTC date, so a bill paid before
 * 05:30 IST read as paid the day before, and a payment made last week could only be recorded as
 * today's.
 */
export default function PayHireBillModal({
  bill,
  onClose,
}: {
  bill: HireBillFull;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = useMutation({
    mutationFn: () =>
      payHireBill(bill.id, {
        paymentDate,
        paymentReference: reference.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success(`${bill.equipmentCode}: payment recorded.`);
      onClose();
    },
    onError: (err) =>
      setError(errorMessage(err, 'Could not record that payment.')),
  });

  return (
    <Modal
      title="Mark this hire bill paid"
      onClose={onClose}
      isDirty={reference.trim() !== ''}
      pending={pay.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="pay-hire-bill-form"
            loading={pay.isPending}
            disabled={!reference.trim() || !paymentDate}
          >
            Mark paid
          </Button>
        </>
      }
    >
      <form
        id="pay-hire-bill-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          pay.mutate();
        }}
      >
        <FormError message={error} />
        <p className="text-sm text-gray-700">
          {bill.equipmentCode} · {bill.vendorName} · net payable{' '}
          <strong>{rupees(bill.netPayable)}</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="pay-date"
            label="Payment date"
            type="date"
            required
            max={todayIso()}
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
          <TextField
            id="pay-reference"
            label="Payment reference"
            required
            maxLength={80}
            placeholder="NEFT / UTR / cheque no."
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

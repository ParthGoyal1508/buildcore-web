'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { updateTransferStatus, type Transfer } from '@/app/lib/api/inventory';
import { quantity as formatQuantity } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  fieldClass,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';

/** The server's `@MaxLength` on `shortageReason`. */
const REASON_MAX = 500;

/**
 * Marking a transfer received, with what actually arrived (2026-10-15).
 *
 * The quantity starts at what was sent, because that is the usual answer and retyping it is
 * where typos come from. When less arrived, the stock transfer slip prints the difference — a
 * short delivery then has a document behind it instead of a conversation.
 *
 * 036 M3 (2026-10-17): a short delivery now needs a reason — the server writes the difference off
 * as a loss at the receiving store and refuses one without — and more than was sent is refused
 * here before the server refuses it too.
 */
export default function TransferReceiveModal({
  transfer,
  onClose,
}: {
  transfer: Transfer;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [quantity, setQuantity] = useState(String(transfer.quantity));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const received = Number(quantity);
  const quantityError =
    quantity !== '' && received > transfer.quantity
      ? `More than the ${formatQuantity(transfer.quantity)} ${transfer.unit} sent.`
      : undefined;
  const short =
    quantity !== '' && !quantityError && received < transfer.quantity
      ? // Rounded to the three places quantities carry, so 15.811 − 15.8 reads 0.011.
        Math.round((transfer.quantity - received) * 1000) / 1000
      : 0;

  const save = useMutation({
    mutationFn: () =>
      updateTransferStatus(
        transfer.id,
        'received',
        received,
        short ? reason.trim() : undefined,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(
        short
          ? `Received with ${formatQuantity(short)} ${transfer.unit} short`
          : 'Transfer marked received',
      );
      onClose();
    },
    // The form stays as typed; the server's own reason is shown.
    onError: (err) =>
      setError(errorMessage(err, 'Could not mark this transfer received.')),
  });

  const ready =
    quantity !== '' &&
    received >= 0 &&
    !quantityError &&
    (!short || reason.trim().length > 0);

  return (
    <Modal
      title="Mark received"
      onClose={onClose}
      isDirty={Boolean(reason) || quantity !== String(transfer.quantity)}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="transfer-receive-form"
            disabled={!ready}
            loading={save.isPending}
          >
            Mark received
          </Button>
        </>
      }
    >
      <form
        id="transfer-receive-form"
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {transfer.transferNo ? `${transfer.transferNo} · ` : ''}
          {formatQuantity(transfer.quantity)} {transfer.unit} of {transfer.itemName} from{' '}
          {transfer.fromSiteName} to {transfer.toSiteName}.
        </p>
        <TextField
          id="transfer-received-qty"
          label={`Quantity received (${transfer.unit}) *`}
          type="number"
          inputMode="decimal"
          required
          min={0}
          max={transfer.quantity}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={quantityError}
          hint={
            short
              ? `${formatQuantity(short)} ${transfer.unit} short — written off at ${transfer.toSiteName}, and the slip shows the difference.`
              : 'As sent, unless less arrived.'
          }
        />
        {short > 0 && (
          <div>
            <label
              htmlFor="transfer-shortage-reason"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Reason for the shortage <span className="text-red-600">*</span>
            </label>
            <textarea
              id="transfer-shortage-reason"
              required
              rows={2}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. 2 bags torn in transit"
              aria-describedby="transfer-shortage-reason-hint"
              className={fieldClass}
            />
            <p
              id="transfer-shortage-reason-hint"
              className="mt-1 text-xs text-gray-500"
            >
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        )}
        <FormError message={error} />
      </form>
    </Modal>
  );
}

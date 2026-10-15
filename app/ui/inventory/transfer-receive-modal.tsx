'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { updateTransferStatus, type Transfer } from '@/app/lib/api/inventory';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/**
 * Marking a transfer received, with what actually arrived (2026-10-15).
 *
 * The quantity starts at what was sent, because that is the usual answer and retyping it is
 * where typos come from. When less arrived, the stock transfer slip prints the difference — a
 * short delivery then has a document behind it instead of a conversation.
 */
export default function TransferReceiveModal({
  transfer,
  onClose,
}: {
  transfer: Transfer;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(String(transfer.quantity));
  const [error, setError] = useState<string | null>(null);

  const received = Number(quantity);
  const quantityError =
    quantity !== '' && received > transfer.quantity
      ? `More than the ${transfer.quantity} ${transfer.unit} sent.`
      : undefined;
  const short =
    quantity !== '' && !quantityError && received < transfer.quantity
      ? // Rounded to the three places quantities carry, so 15.811 − 15.8 reads 0.011.
        Math.round((transfer.quantity - received) * 1000) / 1000
      : 0;

  const save = useMutation({
    mutationFn: () => updateTransferStatus(transfer.id, 'received', received),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not mark this transfer received.',
      ),
  });

  const ready = quantity !== '' && received >= 0 && !quantityError;

  return (
    <Modal
      title="Mark received"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="transfer-receive-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Mark received'}
          </Button>
        </div>
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
          {transfer.quantity} {transfer.unit} of {transfer.itemName} from{' '}
          {transfer.fromSiteName} to {transfer.toSiteName}.
        </p>
        <TextField
          id="transfer-received-qty"
          label={`Quantity received (${transfer.unit})`}
          type="number"
          min={0}
          max={transfer.quantity}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={quantityError}
          hint={
            short
              ? `${short} ${transfer.unit} short — the slip will show the difference.`
              : 'As sent, unless less arrived.'
          }
        />
        <FormError message={error} />
      </form>
    </Modal>
  );
}

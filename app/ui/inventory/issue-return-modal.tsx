'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { recordIssueReturn, type Issue } from '@/app/lib/api/inventory';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { todayIso, dateLabel } from '@/app/lib/format';

const today = () => todayIso();

/**
 * Material coming back to the store against an issue (2026-10-15) — the Daily Issue Register's
 * "Received Qty", "Returned On" and "Received By".
 *
 * The quantity is the **total returned so far**, not this return alone, and it starts at the
 * figure already recorded: the register prints one received quantity per issue, so a second
 * return is a correction of that one number. The server refuses more than was issued or less
 * than was already returned (400), and the same two limits are checked here first so the user
 * learns it beside the field. Stock goes back on the server; nothing here touches it.
 */
export default function IssueReturnModal({
  issue,
  onClose,
}: {
  issue: Issue;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const already = issue.returnedQuantity ?? 0;

  const [quantity, setQuantity] = useState(already ? String(already) : '');
  const [returnedOn, setReturnedOn] = useState(today());
  const [receivedBy, setReceivedBy] = useState(issue.receivedBy ?? '');
  const [error, setError] = useState<string | null>(null);

  const total = Number(quantity);
  const quantityError =
    quantity === ''
      ? undefined
      : total > issue.quantity
        ? `More than the ${issue.quantity} ${issue.unit} issued.`
        : total < already
          ? `Less than the ${already} ${issue.unit} already returned.`
          : undefined;

  const save = useMutation({
    mutationFn: () =>
      recordIssueReturn(issue.id, {
        returnedQuantity: total,
        returnedOn,
        receivedBy: receivedBy.trim(),
      }),
    onSuccess: () => {
      // The store's stock changed too, so everything inventory is stale.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not record this return.',
      ),
  });

  const ready =
    quantity !== '' &&
    total > 0 &&
    !quantityError &&
    returnedOn &&
    receivedBy.trim();

  return (
    <Modal
      title="Material returned"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="issue-return-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Record return'}
          </Button>
        </div>
      }
    >
      <form
        id="issue-return-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
          {issue.slipNo ? `${issue.slipNo} · ` : ''}
          {issue.quantity} {issue.unit} of {issue.itemName} issued to{' '}
          {issue.vendorName ?? issue.issuedTo} on {dateLabel(issue.date)}.
        </p>

        <TextField
          id="return-quantity"
          label={`Total returned so far (${issue.unit})`}
          type="number"
          min={already || 0}
          max={issue.quantity}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={quantityError}
          hint={
            already
              ? `${already} already recorded — enter the new total, not this return alone.`
              : `Up to ${issue.quantity}.`
          }
        />

        <TextField
          id="return-date"
          label="Returned on"
          type="date"
          value={returnedOn}
          onChange={(event) => setReturnedOn(event.target.value)}
        />

        <div className="sm:col-span-2">
          <TextField
            id="return-received-by"
            label="Received by"
            placeholder="Storekeeper who took it back"
            autoComplete="off"
            value={receivedBy}
            onChange={(event) => setReceivedBy(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      </form>
    </Modal>
  );
}

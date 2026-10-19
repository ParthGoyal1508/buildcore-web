'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { recordIssueReturn, type Issue } from '@/app/lib/api/inventory';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { todayIso, dateLabel, quantity as qty } from '@/app/lib/format';
import { useToast } from '@/app/ui/toast';

const today = () => todayIso();

/**
 * Material coming back to the store against an issue (2026-10-15) — the Daily Issue Register's
 * "Received Qty", "Returned On" and "Received By".
 *
 * The quantity is **what is coming back now** (036 M4). It used to be the total returned so far,
 * prefilled with the last figure — which people read as "this return" and so double-counted or
 * under-counted. The server adds it to what came back before and refuses more than is still out
 * ("at most N more"); the same limit is checked here first so the person learns it beside the
 * field. Stock goes back on the server; nothing here touches it.
 */
export default function IssueReturnModal({
  issue,
  onClose,
}: {
  issue: Issue;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const already = issue.returnedQuantity ?? 0;
  // In thousandths, the column's precision, so 10 − 9.7 is 0.3 and not 0.3000000000000007.
  const outstanding = Math.max(
    0,
    (Math.round(issue.quantity * 1000) - Math.round(already * 1000)) / 1000,
  );

  const [quantity, setQuantity] = useState('');
  const [returnedOn, setReturnedOn] = useState(today());
  const [receivedBy, setReceivedBy] = useState(issue.receivedBy ?? '');
  const [error, setError] = useState<string | null>(null);

  const now = Number(quantity);
  const quantityError =
    quantity === ''
      ? undefined
      : now <= 0
        ? 'Enter the quantity coming back.'
        : Math.round(now * 1000) > Math.round(outstanding * 1000)
          ? `At most ${qty(outstanding)} ${issue.unit} more can come back.`
          : undefined;

  const save = useMutation({
    mutationFn: () =>
      recordIssueReturn(issue.id, {
        returnedNow: now,
        returnedOn,
        receivedBy: receivedBy.trim(),
      }),
    onSuccess: () => {
      // The store's stock changed too, so everything inventory is stale.
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`${qty(now)} ${issue.unit} back in the store`);
      onClose();
    },
    onError: (err) =>
      setError(errorMessage(err, 'Could not record this return.')),
  });

  const ready =
    quantity !== '' &&
    now > 0 &&
    !quantityError &&
    returnedOn &&
    receivedBy.trim();

  return (
    <Modal
      title="Material returned"
      onClose={onClose}
      isDirty={quantity !== '' || receivedBy !== (issue.receivedBy ?? '')}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="issue-return-form"
            disabled={!ready}
            loading={save.isPending}
          >
            Record return
          </Button>
        </>
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
          label={`Coming back now (${issue.unit}) *`}
          type="number"
          inputMode="decimal"
          required
          min={0}
          max={outstanding}
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={quantityError}
          hint={
            already
              ? `${qty(already)} already returned; up to ${qty(outstanding)} more.`
              : `Up to ${qty(issue.quantity)}.`
          }
        />

        <TextField
          id="return-date"
          label="Returned on *"
          type="date"
          required
          max={todayIso()}
          value={returnedOn}
          onChange={(event) => setReturnedOn(event.target.value)}
        />

        <div className="sm:col-span-2">
          <TextField
            id="return-received-by"
            label="Received by *"
            required
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

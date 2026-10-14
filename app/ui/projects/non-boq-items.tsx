'use client';

import { useState } from 'react';

import {
  type BillPackageClaim,
  type NonBoqItemInput,
  addNonBoqItem,
  removeNonBoqItem,
  updateNonBoqItem,
} from '@/app/lib/api/bill-packages';
import { Button } from '@/app/ui/button';
import { describe } from '@/app/ui/projects/bill-lifecycle';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Non-BOQ items on a bill to the client (2026-10-14) — work the tendered BOQ does not list.
 *
 * An item added here joins the project's BOQ as `NB-1`, `NB-2`…, so every later bill to the client
 * lists it again with its quantity up to previous. It is billed at `quantity × rate` with no tender
 * premium, and its quantity is the one entered on the bill — no daily report measures it.
 *
 * The amount shown while typing is a preview; the figure on the bill is the server's, as everywhere
 * else on this screen.
 */
export function AddNonBoqItem({
  packageId,
  onSaved,
}: {
  packageId: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NonBoqItemInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <SecondaryButton type="button" onClick={() => setOpen(true)}>
        + Add non-BOQ item
      </SecondaryButton>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await addNonBoqItem(packageId, {
            description: draft.description.trim(),
            unit: draft.unit.trim(),
            quantity: draft.quantity.trim(),
            rate: draft.rate.trim(),
          });
          setDraft(EMPTY);
          setOpen(false);
          onSaved();
        } catch (err) {
          setError(describe(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <h4 className="text-sm font-semibold text-gray-900">Add a non-BOQ item</h4>
      <ItemFields draft={draft} onChange={setDraft} withQuantity />
      <p className="text-xs text-gray-500">
        Billed at quantity × rate, without the tender premium. Later bills to
        this client list it again, numbered NB-1, NB-2…
      </p>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            saving ||
            !draft.description.trim() ||
            !draft.unit.trim() ||
            !isNumber(draft.quantity) ||
            !isNumber(draft.rate)
          }
        >
          {saving ? 'Adding…' : 'Add to this bill'}
        </Button>
        <SecondaryButton
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft(EMPTY);
            setError(null);
          }}
        >
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}

/**
 * Correcting or removing a non-BOQ item on a draft bill. The quantity is edited on the line itself,
 * like any other; this is the description, unit and rate — refused by the API once an issued bill
 * carries the item, because that bill stated it at this rate.
 */
export function NonBoqItemEditor({
  packageId,
  claim,
  onSaved,
  onClose,
}: {
  packageId: string;
  claim: BillPackageClaim;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<NonBoqItemInput>({
    description: claim.description,
    unit: claim.unit,
    quantity: claim.claimedQty,
    rate: claim.rate,
  });
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
      onClose();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ItemFields draft={draft} onChange={setDraft} />
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={
            busy ||
            !draft.description.trim() ||
            !draft.unit.trim() ||
            !isNumber(draft.rate)
          }
          onClick={() =>
            run(() =>
              updateNonBoqItem(packageId, claim.scheduleLineId, {
                description: draft.description.trim(),
                unit: draft.unit.trim(),
                rate: draft.rate.trim(),
              }),
            )
          }
        >
          Save item
        </Button>
        <SecondaryButton type="button" onClick={onClose}>
          Cancel
        </SecondaryButton>
        {confirmRemove ? (
          <span className="flex items-center gap-2 text-sm text-red-800">
            Remove {claim.boqNo} from this bill and the project?
            <button
              type="button"
              disabled={busy}
              className="font-medium underline"
              onClick={() =>
                run(() => removeNonBoqItem(packageId, claim.scheduleLineId))
              }
            >
              Yes, remove
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => setConfirmRemove(false)}
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-red-700 underline"
            onClick={() => setConfirmRemove(true)}
          >
            Remove item
          </button>
        )}
      </div>
    </div>
  );
}

function ItemFields({
  draft,
  onChange,
  withQuantity = false,
}: {
  draft: NonBoqItemInput;
  onChange: (next: NonBoqItemInput) => void;
  withQuantity?: boolean;
}) {
  const preview =
    isNumber(draft.quantity) && isNumber(draft.rate)
      ? (Number(draft.quantity) * Number(draft.rate)).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—';
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <TextField
          id="non-boq-description"
          label="Description"
          required
          maxLength={500}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </div>
      <TextField
        id="non-boq-unit"
        label="Unit"
        required
        maxLength={20}
        hint="Cum, Sqm, Nos…"
        value={draft.unit}
        onChange={(e) => onChange({ ...draft, unit: e.target.value })}
      />
      {withQuantity && (
        <TextField
          id="non-boq-quantity"
          label="Quantity / No."
          required
          inputMode="decimal"
          value={draft.quantity}
          onChange={(e) => onChange({ ...draft, quantity: e.target.value })}
        />
      )}
      <TextField
        id="non-boq-rate"
        label="Rate (₹)"
        required
        inputMode="decimal"
        value={draft.rate}
        onChange={(e) => onChange({ ...draft, rate: e.target.value })}
      />
      {withQuantity && (
        <div className="flex flex-col justify-end sm:col-span-6">
          <p className="text-sm text-gray-700">
            Amount: <strong className="tabular-nums">₹{preview}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

const EMPTY: NonBoqItemInput = {
  description: '',
  unit: '',
  quantity: '',
  rate: '',
};

function isNumber(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  createReimbursementClaim,
  getReimbursementCategories,
  updateReimbursementClaim,
  type ClaimInput,
  type ReimbursementClaim,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/** Matches the backend's DECIMAL(12,2): more precision would be silently rounded. */
const AMOUNT_STEP = '0.01';

const EMPTY = {
  categoryId: '',
  amount: '',
  expenseDate: '',
  description: '',
};

/** `null` threshold means a receipt is never required — `0` means always. */
function receiptIsRequired(
  threshold: number | null | undefined,
  amount: number,
): boolean {
  return threshold !== null && threshold !== undefined && amount > threshold;
}

/**
 * Reads a chosen file as base64 for the claim payload.
 *
 * The receipt travels inside the create/edit request rather than through a
 * separate upload, so an abandoned claim leaves no orphaned blob behind — the same
 * shape enrolment uses for its photos.
 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * File or edit one reimbursement claim (US8).
 *
 * Handles both, because the two differ only in which endpoint they call and
 * whether the fields start populated — splitting them would duplicate the
 * receipt-threshold logic, which is the only part with any real behaviour in it.
 */
export default function ReimbursementForm({
  editing,
  onDone,
}: {
  /** The draft being edited, or undefined to file a new claim. */
  editing?: ReimbursementClaim;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(
    editing
      ? {
          categoryId: editing.categoryId,
          amount: String(editing.amount),
          expenseDate: editing.expenseDate.slice(0, 10),
          description: editing.description,
        }
      : EMPTY,
  );
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['my', 'reimbursement-categories'],
    queryFn: getReimbursementCategories,
  });

  const amount = Number(form.amount) || 0;
  const category = useMemo(
    () => categories?.find((c) => c.id === form.categoryId),
    [categories, form.categoryId],
  );

  // The employee already has a receipt on file when editing a draft that carried
  // one, so the requirement is satisfied without re-attaching it.
  const hasReceipt = receipt !== null || Boolean(editing?.receiptRef);
  const needsReceipt = receiptIsRequired(category?.receiptRequiredAbove, amount);
  const receiptMissing = needsReceipt && !hasReceipt;

  const submit = useMutation({
    mutationFn: (status: 'draft' | 'submitted') => {
      const input: ClaimInput = {
        categoryId: form.categoryId,
        amount,
        expenseDate: form.expenseDate,
        description: form.description.trim(),
        ...(receipt ? { receipt } : {}),
        status,
      };
      return editing
        ? updateReimbursementClaim(editing.id, input)
        : createReimbursementClaim(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'reimbursements'] });
      onDone();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  const complete =
    form.categoryId !== '' &&
    amount > 0 &&
    form.expenseDate !== '' &&
    form.description.trim() !== '';
  // Blocked client-side as well as server-side: the backend rejects it either way
  // (FR-030), but letting the employee fill in a whole claim and only then be told
  // it was never fileable is the worse of the two ways to enforce it.
  const canSubmit = complete && !receiptMissing && !submit.isPending;

  async function onFileChange(file: File | undefined) {
    if (!file) {
      setReceipt(null);
      setReceiptName(null);
      return;
    }
    try {
      setReceipt(await readAsBase64(file));
      setReceiptName(file.name);
      setError(null);
    } catch {
      setError('Could not read that file. Try a different photo.');
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium text-gray-900">
        {editing ? 'Edit draft claim' : 'New claim'}
      </h2>

      <FormError message={error} />

      <SelectField
        id="claim-category"
        label="Category"
        value={form.categoryId}
        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
      >
        <option value="">
          {categoriesLoading ? 'Loading categories…' : 'Choose a category'}
        </option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.receiptRequiredAbove !== null &&
              ` — receipt needed above ${c.receiptRequiredAbove}`}
          </option>
        ))}
      </SelectField>

      {categories?.length === 0 && !categoriesLoading && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your company has no reimbursement categories set up yet, so a claim
          cannot be filed. Ask an administrator to add one.
        </p>
      )}

      <TextField
        id="claim-amount"
        label="Amount"
        type="number"
        min="0"
        step={AMOUNT_STEP}
        inputMode="decimal"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />

      <TextField
        id="claim-date"
        label="Expense date"
        type="date"
        // A claim cannot be for money not yet spent.
        max={new Date().toISOString().slice(0, 10)}
        value={form.expenseDate}
        onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
      />

      <TextField
        id="claim-description"
        label="Description"
        maxLength={500}
        value={form.description}
        placeholder="e.g. Taxi from site office to the depot"
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div>
        <label
          htmlFor="claim-receipt"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Receipt{needsReceipt ? '' : ' (optional)'}
        </label>
        <input
          id="claim-receipt"
          type="file"
          accept="image/*"
          // `capture` is a hint, not a lock: on a phone it opens the camera
          // straight away, and on a desktop browser it is ignored and the normal
          // file picker appears.
          capture="environment"
          onChange={(e) => onFileChange(e.target.files?.[0])}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        {receiptName && (
          <p className="mt-1 text-xs text-gray-500">Attached: {receiptName}</p>
        )}
        {!receiptName && editing?.receiptRef && (
          <p className="mt-1 text-xs text-gray-500">
            A receipt is already attached. Choosing a file replaces it.
          </p>
        )}
        {receiptMissing && category && (
          <p className="mt-1 text-xs text-amber-700" role="alert">
            {MESSAGES.claimReceiptRequired(
              category.name,
              category.receiptRequiredAbove as number,
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => submit.mutate('submitted')}
          disabled={!canSubmit}
        >
          {submit.isPending ? 'Saving…' : 'Submit claim'}
        </Button>
        {/* A draft skips the receipt rule: it is not in review yet, so demanding
            the paperwork before the employee can save their place is friction with
            no purpose. The rule still applies the moment they submit. */}
        <SecondaryButton
          type="button"
          onClick={() => submit.mutate('draft')}
          disabled={!complete || submit.isPending}
        >
          Save as draft
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onDone}>
          Cancel
        </SecondaryButton>
      </div>
    </section>
  );
}

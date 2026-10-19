'use client';

import { DocumentIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { errorMessage } from '@/app/lib/api/client';
import {
  createReimbursementClaim,
  getMyReimbursementReceipt,
  getReimbursementCategories,
  updateReimbursementClaim,
  type ClaimInput,
  type ReimbursementClaim,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { openStoredFile } from '@/app/lib/download-file';
import { MAX_UPLOAD_BYTES } from '@/app/lib/files';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import QueryError from '@/app/ui/query-error';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { rupees, todayIso } from '@/app/lib/format';

/**
 * What the API stores as a receipt (036 G5): a photo it can normalise, or a PDF. Narrower than the
 * kit's `ACCEPT_IMAGES_AND_PDF` on purpose — HEIC is not decoded by most browsers, so it would go up
 * uncompressed and be refused with a 415. iOS hands the picker a JPEG when HEIC is not listed.
 */
const RECEIPT_ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';

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
 * Opens a claim's receipt — a photo or a PDF, in a new tab — from the employee's own endpoint
 * (036 G5). `viewing` is the claim id in flight, for the button's spinner. Shared by the claim list
 * and the edit form.
 */
export function useViewReceipt() {
  const toast = useToast();
  const [viewing, setViewing] = useState<string | null>(null);
  async function viewReceipt(id: string) {
    setViewing(id);
    try {
      openStoredFile(await getMyReimbursementReceipt(id), 'receipt');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open the receipt. Please try again.'));
    } finally {
      setViewing(null);
    }
  }
  return { viewReceipt, viewing };
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
  const toast = useToast();
  // 036 G5: through the kit `FileUpload` — a photo is shrunk before it goes up over a site
  // connection, the type and the 10 MB limit are checked before reading, and a PDF is accepted.
  const [receipt, setReceipt] = useState<PreparedFile | null>(null);
  // Edit only: the employee chose to take the receipt on file off the claim.
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { viewReceipt, viewing } = useViewReceipt();

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
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
  const existingReceipt = Boolean(editing?.receiptRef) && !removeExisting;
  const hasReceipt = receipt !== null || existingReceipt;
  const needsReceipt = receiptIsRequired(
    category?.receiptRequiredAbove,
    amount,
  );
  const receiptMissing = needsReceipt && !hasReceipt;

  const submit = useMutation({
    mutationFn: (status: 'draft' | 'submitted') => {
      const input: ClaimInput = {
        categoryId: form.categoryId,
        amount,
        expenseDate: form.expenseDate,
        description: form.description.trim(),
        // 036 G5: only ever the uploaded file. `receiptRef` is sent solely as `null`, to take the
        // receipt on file off; the server no longer accepts a client string as a receipt.
        ...(receipt
          ? { receipt: receipt.base64 }
          : editing && removeExisting
            ? { receiptRef: null }
            : {}),
        status,
      };
      return editing
        ? updateReimbursementClaim(editing.id, input)
        : createReimbursementClaim(input);
    },
    onSuccess: (_claim, status) => {
      queryClient.invalidateQueries({ queryKey: ['my', 'reimbursements'] });
      toast.success(status === 'draft' ? 'Draft saved' : 'Claim submitted');
      onDone();
    },
    // The form keeps everything typed and the file picked, so a retry is one tap.
    onError: (err: unknown) => setError(errorMessage(err, MESSAGES.saveFailed)),
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

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium text-gray-900">
        {editing ? 'Edit draft claim' : 'New claim'}
      </h2>

      <FormError message={error} />

      {categoriesError && (
        <QueryError
          compact
          error={categoriesError}
          fallback="Could not load the claim categories."
          onRetry={refetchCategories}
        />
      )}

      <SelectField
        id="claim-category"
        label="Category"
        required
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
              ` — receipt needed above ${rupees(c.receiptRequiredAbove)}`}
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
        label="Amount (₹)"
        required
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
        required
        type="date"
        // A claim cannot be for money not yet spent. Today in India (036 G5): the UTC date this
        // once used refused today's expense until 05:30 IST.
        max={todayIso()}
        value={form.expenseDate}
        onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
      />

      <TextField
        id="claim-description"
        label="Description"
        required
        maxLength={500}
        value={form.description}
        placeholder="e.g. Taxi from site office to the depot"
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      <div className="space-y-2">
        <FileUpload
          id="claim-receipt"
          label={`Receipt${needsReceipt ? '' : ' (optional)'}`}
          accept={RECEIPT_ACCEPT}
          maxBytes={MAX_UPLOAD_BYTES}
          compress
          hint="A photo (JPEG, PNG, WebP) or a PDF, up to 10 MB."
          onSelect={setReceipt}
          disabled={submit.isPending}
        />
        {/* The receipt already on the draft: openable, removable, and replaced by a new pick. */}
        {editing?.receiptRef && !receipt && (
          <div className="flex max-w-md flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm">
            <DocumentIcon
              aria-hidden="true"
              className="h-6 w-6 shrink-0 text-gray-400"
            />
            <span className="min-w-0 flex-1 text-gray-700">
              {removeExisting
                ? 'The receipt on file will be removed when you save.'
                : 'A receipt is on file. Choosing a file replaces it.'}
            </span>
            {removeExisting ? (
              <RowAction
                type="button"
                intent="read"
                onClick={() => setRemoveExisting(false)}
              >
                Keep it
              </RowAction>
            ) : (
              <>
                <RowAction
                  type="button"
                  intent="read"
                  loading={viewing === editing.id}
                  onClick={() => void viewReceipt(editing.id)}
                >
                  View receipt
                </RowAction>
                <RowAction
                  type="button"
                  className="text-red-600"
                  onClick={() => setRemoveExisting(true)}
                >
                  Remove
                </RowAction>
              </>
            )}
          </div>
        )}
        {receiptMissing && category && (
          <p className="text-xs text-amber-700" role="alert">
            {/* With ₹ (036 G5); `MESSAGES.claimReceiptRequired` prints the bare number. */}
            {`${category.name} claims above ${rupees(category.receiptRequiredAbove)} need a receipt attached.`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => submit.mutate('submitted')}
          disabled={!canSubmit}
          loading={submit.isPending && submit.variables === 'submitted'}
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
          loading={submit.isPending && submit.variables === 'draft'}
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

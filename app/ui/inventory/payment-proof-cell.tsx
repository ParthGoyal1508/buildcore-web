'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  attachPaymentProof,
  downloadPaymentProof,
  type Payment,
} from '@/app/lib/api/inventory';
import { errorMessage } from '@/app/lib/api/client';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import {
  compressImage,
  fileToBase64,
  formatBytes,
  matchesAccept,
  MAX_UPLOAD_BYTES,
} from '@/app/lib/files';
import { dateTimeLabel } from '@/app/lib/format';
import { useToast } from '@/app/ui/toast';

/** What the API takes as proof (036 M11): a PDF advice or a photo/screenshot of it. */
const ACCEPT_PROOF =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
import { useFileViewer } from '@/app/ui/pdf-viewer';

/**
 * One payment's transfer proof — the RTGS advice or confirmation (017 FR-020, bugs.md item 23).
 *
 * ## The gap this closes
 *
 * A payment carried a reference number somebody typed and **nothing behind it**. Six months later,
 * reconciling against a bank statement, the only evidence a transfer happened was that a colleague
 * had typed a number into a form. That is the whole of item 23.
 *
 * ## Absence is a fact, not an error
 *
 * A payment with no proof renders as a plain statement and an action, never as a warning: a payment
 * is often recorded before the advice arrives, and nobody did anything wrong. The amber is on the
 * *filter* — "show me the ones still missing proof" is the question worth asking — rather than on
 * every row that has not caught up yet.
 *
 * Re-attaching replaces the current proof and the server keeps the old blob, deliberately: the first
 * advice is itself a record of what was believed at the time.
 *
 * 036 M11: the picker accepts only what the server takes (PDF or a photo), checks the 10 MB limit
 * before reading the file, compresses a photographed advice, shows the server's own refusal (415,
 * 413) instead of a generic failure, clears itself after every attempt so the same file can be
 * picked again, and offers **Replace** once a proof is attached — it could not be replaced before.
 */
export default function PaymentProofCell({ payment }: { payment: Payment }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A PDF or a photo opens in the page's own viewer (2026-10-14) rather than a new tab, which most
  // browsers block when it is opened after a fetch; any other file is still saved.
  const { show, viewer } = useFileViewer();

  const attach = async (input: HTMLInputElement) => {
    const picked = input.files?.[0];
    // Cleared at once, so picking the same file again after a refusal fires a change.
    input.value = '';
    if (!picked) return;
    setError(null);
    if (!matchesAccept(picked, ACCEPT_PROOF)) {
      setError('Attach a PDF or a photo (JPEG, PNG or WebP) of the advice.');
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${formatBytes(picked.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const file = picked.type.startsWith('image/')
        ? await compressImage(picked)
        : picked;
      await attachPaymentProof(payment.id, {
        data: await fileToBase64(file),
        contentType: file.type || 'application/octet-stream',
      });
      toast.success(payment.hasProof ? 'Proof replaced' : 'Proof attached');
      // The whole inventory tree, because a payment's proof shows on its row and the row is
      // reachable from more than one list.
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) {
      setError(errorMessage(err, DOCUMENT_COPY.proofAttachFailed));
    } finally {
      setBusy(false);
    }
  };

  const picker = (label: string) => (
    <label className="cursor-pointer self-start text-xs font-medium text-brand-700 hover:underline">
      {busy ? DOCUMENT_COPY.proofUploading : label}
      {/* The input itself is hidden behind its label rather than rendered bare: a file
          input in a table cell is wider than any sensible column. */}
      <input
        type="file"
        accept={ACCEPT_PROOF}
        className="sr-only"
        disabled={busy}
        onChange={(event) => void attach(event.currentTarget)}
      />
    </label>
  );

  const open = async () => {
    setError(null);
    try {
      show(
        await downloadPaymentProof(payment.id),
        `payment-proof-${payment.id}`,
      );
    } catch (err) {
      setError(errorMessage(err, DOCUMENT_COPY.proofDownloadFailed));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {viewer}
      {payment.hasProof ? (
        <>
          <button
            type="button"
            onClick={() => void open()}
            className="self-start rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {DOCUMENT_COPY.proofOpen}
          </button>
          <span className="text-xs text-gray-500">
            {payment.proofUploadedAt
              ? DOCUMENT_COPY.proofAttachedOn(
                  dateTimeLabel(payment.proofUploadedAt.toISOString()),
                )
              : DOCUMENT_COPY.proofAttached}
          </span>
          {picker('Replace')}
        </>
      ) : (
        <>
          <span className="text-xs text-gray-500">
            {DOCUMENT_COPY.proofMissing}
          </span>
          {picker(DOCUMENT_COPY.proofAttach)}
        </>
      )}
      {error && (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

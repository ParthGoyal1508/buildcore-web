'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  attachPaymentProof,
  downloadPaymentProof,
  type Payment,
} from '@/app/lib/api/inventory';
import { fileToBase64 } from '@/app/lib/api/project-documents';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';

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
 */
export default function PaymentProofCell({ payment }: { payment: Payment }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attach = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await attachPaymentProof(payment.id, {
        data: await fileToBase64(file),
        contentType: file.type || 'application/octet-stream',
      });
      // The whole inventory tree, because a payment's proof shows on its row and the row is
      // reachable from more than one list.
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch {
      setError(DOCUMENT_COPY.proofAttachFailed);
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    setError(null);
    try {
      const blob = await downloadPaymentProof(payment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(DOCUMENT_COPY.proofDownloadFailed);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {payment.hasProof ? (
        <>
          <button
            type="button"
            onClick={() => void open()}
            className="self-start rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
        </>
      ) : (
        <>
          <span className="text-xs text-gray-500">
            {DOCUMENT_COPY.proofMissing}
          </span>
          <label className="cursor-pointer text-xs font-medium text-blue-700 hover:underline">
            {busy ? DOCUMENT_COPY.proofUploading : DOCUMENT_COPY.proofAttach}
            {/* The input itself is hidden behind its label rather than rendered bare: a file
                input in a table cell is wider than any sensible column. */}
            <input
              type="file"
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                void attach(event.target.files?.[0] ?? undefined)
              }
            />
          </label>
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

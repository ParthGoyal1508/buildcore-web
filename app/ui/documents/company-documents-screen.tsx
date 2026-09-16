'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  defineRequiredKind,
  downloadCompanyDocument,
  getCompanyDocuments,
  uploadCompanyDocument,
  type CompanyDocument,
  type MissingKind,
} from '@/app/lib/api/company-documents';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { CompletenessPanel } from '@/app/ui/documents/completeness-panel';
import {
  DocumentUpload,
  type UploadKind,
} from '@/app/ui/documents/document-upload';
import { RestrictedNotice } from '@/app/ui/documents/restricted-badge';
import { useCompanyContext } from '@/app/ui/settings/company-context';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';

/**
 * The company's statutory papers (017 US1).
 *
 * The company record already held GSTIN, PAN, TAN and the rest as *numbers*. This is
 * where the certificates behind them live, and — more usefully — where the ones that are
 * missing are named.
 */
export function CompanyDocumentsScreen() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [defineError, setDefineError] = useState<string | null>(null);

  /**
   * The company is part of the key, not just the request (FR-021).
   *
   * Without it react-query answers a switch from its cache and shows the previous
   * company's documents under the new company's name — the failure mode that looks
   * exactly like success until somebody uploads against it.
   */
  const queryKey = ['company-documents', companyId ?? 'own'];

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => getCompanyDocuments(companyId ?? undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const upload = useMutation({
    mutationFn: uploadCompanyDocument,
    // Invalidated so the completeness panel cannot disagree with the list it sits above.
    // They are one answer from one request; refreshing half of it is how a screen ends up
    // asserting both that a document is on file and that it is missing.
    onSuccess: invalidate,
  });

  /**
   * Materialising a required kind the company never defined a type for (FR-020).
   *
   * Lands the administrator on the upload form for the kind they just defined, because
   * defining a type is never the thing they wanted — it is the step in the way of filing
   * the certificate they have in their hand.
   */
  const define = useMutation({
    mutationFn: (code: string) => defineRequiredKind(code, companyId ?? undefined),
    onSuccess: async (created) => {
      setDefineError(null);
      await invalidate();
      setUploadFor(created.documentTypeId);
    },
    onError: () => setDefineError(DOCUMENT_COPY.defineFailed),
  });

  if (isPending) {
    return <p className="text-sm text-gray-500">Loading documents…</p>;
  }
  if (isError || !data) {
    return <FormError message="The company's documents could not be loaded." />;
  }

  /**
   * What the upload control may offer.
   *
   * Every kind the company has actually defined a type for — required or not (FR-019).
   * A required kind with a null `documentTypeId` is excluded because there is nothing to
   * upload against yet; its row carries "Define and upload" instead, which creates the
   * type and then opens this form on it.
   */
  const kinds: UploadKind[] = [
    ...data.missing
      .filter((m): m is MissingKind & { documentTypeId: string } =>
        Boolean(m.documentTypeId),
      )
      .map((m) => ({
        documentTypeId: m.documentTypeId,
        name: m.label,
        // The server decides; the client cannot know which kinds expire, and guessing
        // would ask for a date the server does not want or skip one it does.
        expires: true,
      })),
    ...[...data.present, ...data.supplementary].map((d) => ({
      documentTypeId: d.documentTypeId,
      name: d.name,
      expires: d.expiresAt !== null,
      isRestricted: d.isRestricted,
    })),
  ];

  const open = async (doc: CompanyDocument) => {
    setDownloadError(null);
    try {
      const blob = await downloadCompanyDocument(doc.id, companyId ?? undefined);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Revoked on a timer rather than immediately: the new tab needs the URL to
      // survive long enough to start reading it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setDownloadError(
        code && err instanceof Error
          ? err.message
          : 'The document could not be downloaded.',
      );
    }
  };

  const rowActions = (doc: CompanyDocument) => (
    <>
      {/* Download, never preview, for a restricted kind — and the same control for
          every kind, because a second download path is a second thing to audit. */}
      <RowAction type="button" onClick={() => void open(doc)}>
        Download
      </RowAction>
      <RowAction
        type="button"
        onClick={() => setUploadFor(doc.documentTypeId)}
      >
        Replace
      </RowAction>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {[...data.present, ...data.supplementary].some((d) => d.isRestricted) && (
        <RestrictedNotice />
      )}
      <FormError message={downloadError} />
      <FormError message={defineError} />

      <CompletenessPanel
        present={data.present}
        missing={data.missing}
        expiringSoon={data.expiringSoon}
        actionsFor={rowActions}
        actionForMissing={(kind) =>
          kind.documentTypeId ? (
            <RowAction
              type="button"
              onClick={() => setUploadFor(kind.documentTypeId)}
            >
              Upload
            </RowAction>
          ) : (
            <RowAction
              type="button"
              disabled={define.isPending}
              onClick={() => define.mutate(kind.code)}
            >
              {DOCUMENT_COPY.defineAndUpload}
            </RowAction>
          )
        }
      />

      {/* Below the panel and outside it: these are held, and they are deliberately not
          part of any figure the panel reports (FR-019). */}
      {data.supplementary.length > 0 && (
        <section aria-labelledby="documents-supplementary">
          <h3
            id="documents-supplementary"
            className="mb-1 text-sm font-medium text-gray-900"
          >
            {DOCUMENT_COPY.supplementaryHeading} ({data.supplementary.length})
          </h3>
          <p className="mb-2 text-xs text-gray-500">
            {DOCUMENT_COPY.supplementaryHint}
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {data.supplementary.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-500">
                    {doc.documentNumber ? `${doc.documentNumber} · ` : ''}
                    {doc.expiresAt
                      ? `Expires ${doc.expiresAt.toISOString().slice(0, 10)}`
                      : 'No expiry'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {rowActions(doc)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          {uploadFor ? 'Upload document' : 'Upload a document'}
        </h3>
        <DocumentUpload
          kinds={kinds}
          ownerLabel="this company"
          initialDocumentTypeId={uploadFor ?? undefined}
          onUpload={(input) =>
            upload.mutateAsync({ ...input, companyId: companyId ?? undefined })
          }
          onDone={() => setUploadFor(null)}
        />
        <p className="mt-3 text-xs text-gray-500">
          {DOCUMENT_COPY.supersedeHint}
        </p>
      </section>
    </div>
  );
}

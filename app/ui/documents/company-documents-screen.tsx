'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createCompanyDocumentKind,
  defineRequiredKind,
  downloadCompanyDocument,
  getCompanyDocuments,
  uploadCompanyDocument,
  type CompanyDocument,
} from '@/app/lib/api/company-documents';
import { errorMessage } from '@/app/lib/api/client';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { CompletenessPanel } from '@/app/ui/documents/completeness-panel';
import {
  DocumentUpload,
  type UploadKind,
} from '@/app/ui/documents/document-upload';
import { RestrictedNotice } from '@/app/ui/documents/restricted-badge';
import {
  DocumentKindForm,
  type DocumentKindInput,
} from '@/app/ui/documents/document-kind-form';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import { dateLabel } from '@/app/lib/format';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';

/**
 * The company's statutory papers (017 US1).
 *
 * The company record already held GSTIN, PAN, TAN and the rest as *numbers*. This is
 * where the certificates behind them live, and — more usefully — where the ones that are
 * missing are named.
 */
export function CompanyDocumentsScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  // Preview opens a PDF or a photo in the page's own viewer (2026-10-14) rather than a new tab,
  // which most browsers block when it is opened after a fetch; Download always saves (2026-10-15).
  const { show, viewer } = useFileViewer();
  const [defineError, setDefineError] = useState<string | null>(null);

  /**
   * No company segment any more (019 FR-005).
   *
   * The hazard this guarded against is real — react-query answering a switch from cache
   * shows the previous company's rows under the new company's name, the failure that looks
   * exactly like success. It is now handled once, centrally: the switcher clears the whole
   * cache, so no screen has to remember to key on a company it no longer knows.
   */
  const queryKey = ['company-documents'];

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getCompanyDocuments(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const upload = useMutation({
    mutationFn: uploadCompanyDocument,
    // Invalidated so the completeness panel cannot disagree with the list it sits above.
    // They are one answer from one request; refreshing half of it is how a screen ends up
    // asserting both that a document is on file and that it is missing.
    onSuccess: async () => {
      await invalidate();
      toast.success('The document has been filed.');
    },
  });

  /**
   * Materialising a required kind the company never defined a type for (FR-020).
   *
   * Lands the administrator on the upload form for the kind they just defined, because
   * defining a type is never the thing they wanted — it is the step in the way of filing
   * the certificate they have in their hand.
   */
  const define = useMutation({
    mutationFn: (code: string) => defineRequiredKind(code),
    onSuccess: async (created) => {
      setDefineError(null);
      await invalidate();
      setUploadFor(created.documentTypeId);
    },
    onError: () => setDefineError(DOCUMENT_COPY.defineFailed),
  });

  /**
   * A kind of the company's own (FR-001b) — an MSME certificate, a trade licence.
   *
   * Lands on the upload form for what was just added, for the same reason "Define and
   * upload" does: nobody sets out to create a document type, they set out to file the
   * certificate in their hand.
   */
  const addKind = useMutation({
    mutationFn: (input: DocumentKindInput) => createCompanyDocumentKind(input),
    onSuccess: async (created) => {
      setDefineError(null);
      await invalidate();
      setUploadFor(created.documentTypeId);
    },
    onError: () => setDefineError(DOCUMENT_COPY.addKindFailed),
  });

  // 036 J4 (2026-10-17): a skeleton while it loads, and a failed load says so with a Retry rather
  // than a red line whose only way out was reloading the page.
  if (isPending) {
    return (
      <ListSkeleton headers={['Document', 'Number', 'Expiry', 'Status']} rows={4} />
    );
  }
  if (isError || !data) {
    return (
      <QueryError
        error={error}
        fallback="The company's documents could not be loaded."
        onRetry={refetch}
      />
    );
  }

  /**
   * What the upload control may offer — the server's `availableKinds`, verbatim.
   *
   * Built from that rather than assembled out of `present`, `missing` and
   * `supplementary`, which is what the first cut of FR-019 did and which could only ever
   * offer a kind that already held a document. A kind defined a minute ago belongs in
   * none of those three lists, so it was impossible to file the first document against.
   *
   * `expires` comes from the kind, not from whether the document on file happens to have
   * a date: an expiring kind with nothing filed yet still has to ask for one.
   */
  const kinds: UploadKind[] = data.availableKinds.map((k) => ({
    documentTypeId: k.documentTypeId,
    name: k.name,
    expires: k.hasExpiry,
    isRestricted: k.isRestricted,
  }));

  /**
   * Fetches the file, then shows it or saves it. The same authenticated, audit-logged endpoint for
   * both: a second download path is a second thing to audit.
   */
  const fetchThen = async (
    doc: CompanyDocument,
    action: 'preview' | 'download',
  ) => {
    try {
      const file = await downloadCompanyDocument(doc.id);
      const fallbackName = `${doc.code}-${doc.id}`;
      // `show` saves anything a frame cannot render (a Word file, a workbook) instead.
      if (action === 'preview') show(file, fallbackName, doc.name);
      else saveBlob(file.blob, file.filename || fallbackName);
    } catch (err) {
      toast.error(errorMessage(err, 'The document could not be downloaded.'));
    }
  };

  const rowActions = (doc: CompanyDocument) => (
    <>
      {/* No preview for a restricted kind (FR-013a): an Aadhaar card on a settings screen is a
          disclosure to everyone who walks past the monitor. Download only. */}
      {!doc.isRestricted && (
        <RowAction type="button" onClick={() => void fetchThen(doc, 'preview')}>
          Preview
        </RowAction>
      )}
      <RowAction type="button" onClick={() => void fetchThen(doc, 'download')}>
        Download
      </RowAction>
      <RowAction type="button" onClick={() => setUploadFor(doc.documentTypeId)}>
        Replace
      </RowAction>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {[...data.present, ...data.supplementary].some((d) => d.isRestricted) && (
        <RestrictedNotice />
      )}
      {viewer}
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
                      ? `Expires ${dateLabel(doc.expiresAt)}`
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
        <h3 className="mb-1 text-sm font-medium text-gray-900">
          {DOCUMENT_COPY.addKindHeading}
        </h3>
        <DocumentKindForm
          idPrefix="company"
          busy={addKind.isPending}
          onCreate={(input) => addKind.mutateAsync(input)}
        />
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          {uploadFor ? 'Upload document' : 'Upload a document'}
        </h3>
        {/* Keyed on the kind asked for: the form reads `initialDocumentTypeId` once, so without a
            remount "Replace" on a row left the picker on whatever kind it already showed (036 J4).
            `hint` blank because the same line is printed just below. */}
        <DocumentUpload
          key={uploadFor ?? 'any'}
          kinds={kinds}
          hint=""
          ownerLabel="this company"
          initialDocumentTypeId={uploadFor ?? undefined}
          onUpload={(input) => upload.mutateAsync({ ...input })}
          onDone={() => setUploadFor(null)}
        />
        <p className="mt-3 text-xs text-gray-500">
          {DOCUMENT_COPY.supersedeHint}
        </p>
      </section>
    </div>
  );
}

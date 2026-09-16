'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
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
import { FormError, RowAction } from '@/app/ui/settings/form-fields';

const QUERY_KEY = ['company-documents'];

/**
 * The company's statutory papers (017 US1).
 *
 * The company record already held GSTIN, PAN, TAN and the rest as *numbers*. This is
 * where the certificates behind them live, and — more usefully — where the ones that are
 * missing are named.
 */
export function CompanyDocumentsScreen() {
  const queryClient = useQueryClient();
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCompanyDocuments,
  });

  const upload = useMutation({
    mutationFn: uploadCompanyDocument,
    // Invalidated so the completeness panel cannot disagree with the list it sits above.
    // They are one answer from one request; refreshing half of it is how a screen ends up
    // asserting both that a document is on file and that it is missing.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  if (isPending) {
    return <p className="text-sm text-gray-500">Loading documents…</p>;
  }
  if (isError || !data) {
    return (
      <FormError message="The company's documents could not be loaded." />
    );
  }

  /**
   * What the upload control may offer.
   *
   * Only kinds the company has actually defined a `DocumentType` for — a missing kind
   * with a null `documentTypeId` has nothing to upload against, and offering it would
   * produce a refusal the form could have avoided.
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
    ...data.present.map((d) => ({
      documentTypeId: d.documentTypeId,
      name: d.name,
      expires: d.expiresAt !== null,
      isRestricted: d.isRestricted,
    })),
  ];

  const open = async (doc: CompanyDocument) => {
    setDownloadError(null);
    try {
      const blob = await downloadCompanyDocument(doc.id);
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

  return (
    <div className="flex flex-col gap-6">
      {data.present.some((d) => d.isRestricted) && <RestrictedNotice />}
      <FormError message={downloadError} />

      <CompletenessPanel
        present={data.present}
        missing={data.missing}
        expiringSoon={data.expiringSoon}
        actionsFor={(doc) => (
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
        )}
        actionForMissing={(kind) =>
          kind.documentTypeId ? (
            <RowAction
              type="button"
              onClick={() => setUploadFor(kind.documentTypeId)}
            >
              Upload
            </RowAction>
          ) : null
        }
      />

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          {uploadFor ? 'Upload document' : 'Upload a document'}
        </h3>
        <DocumentUpload
          kinds={kinds}
          ownerLabel="this company"
          initialDocumentTypeId={uploadFor ?? undefined}
          onUpload={(input) => upload.mutateAsync(input)}
          onDone={() => setUploadFor(null)}
        />
        <p className="mt-3 text-xs text-gray-500">
          {DOCUMENT_COPY.supersedeHint}
        </p>
      </section>
    </div>
  );
}

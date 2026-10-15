'use client';

import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  downloadProjectDocument,
  getDocumentRequirements,
  getProjectDocuments,
  uploadProjectDocument,
  type ProjectDocument,
} from '@/app/lib/api/project-documents';
import { DOCUMENT_COPY, MESSAGES } from '@/app/lib/constants';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
import { saveBlob } from '@/app/lib/download-file';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { Button } from '@/app/ui/button';
import {
  DocumentUpload,
  type UploadKind,
} from '@/app/ui/documents/document-upload';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/**
 * What a project actually holds, and what it still owes (017 FR-024, web T077, T078).
 *
 * ## Why readiness is not enough
 *
 * The project list already shows "3 of 5 required", and that figure cannot answer the question
 * the client's item 3 ends on: *what do we hold for this project*. A screen built only from
 * readiness can answer how far from complete a project is and nothing about the documents
 * themselves — so a supplementary document, filed deliberately and belonging to no required kind,
 * is invisible. That is the same mistake that made supplementary **company** documents invisible
 * and produced this feature's amendment D1; the API's list is unfiltered for exactly that reason,
 * and this panel renders it unfiltered.
 *
 * So there are two lists here and the order matters: what is held first, what is outstanding
 * second. A compliance screen that leads with absence tells somebody what they have not done; a
 * project screen should first say what the project has.
 *
 * ## Outstanding kinds are split by consequence
 *
 * A mandatory kind that is missing means the project could not have been created today; an
 * advisory one means somebody is still chasing paper. Those are different sentences, which is why
 * the API counts them separately and why this does not merge them into one "missing" list.
 */
/**
 * Whether a document has lapsed — **the same rule readiness applies on the server**.
 *
 * Null is no date recorded, not expired: every document filed before 2026-10-09 has none, and
 * reading those as lapsed would mark every project in flight non-compliant. Compared as whole
 * days, because an expiry is a calendar date and a certificate valid "until the 31st" is valid
 * all of the 31st.
 */
function hasLapsed(document: { expiresAt?: string | null }): boolean {
  if (!document.expiresAt) return false;
  return (
    document.expiresAt.slice(0, 10) < new Date().toISOString().slice(0, 10)
  );
}

/** Whole days from today until a document's expiry; negative once it has lapsed. */
function daysToExpiry(expiresAt: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const until = new Date(expiresAt.slice(0, 10));
  return Math.round((until.getTime() - today.getTime()) / 86_400_000);
}

/**
 * The expiry as a pill rather than a line of grey text (2026-10-15) — the client: "highlight the
 * expiry date". Red once lapsed, orange inside thirty days, amber otherwise: a date somebody has
 * to act on before it passes.
 */
function ExpiryPill({ expiresAt }: { expiresAt: string }) {
  const days = daysToExpiry(expiresAt);
  const tone =
    days < 0
      ? 'border-red-200 bg-red-50 text-red-800'
      : days <= 30
        ? 'border-orange-200 bg-orange-50 text-orange-800'
        : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      <CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {days < 0
        ? DOCUMENT_COPY.projectDocumentExpired(dateLabel(expiresAt))
        : DOCUMENT_COPY.projectDocumentExpires(dateLabel(expiresAt))}
      {days >= 0 && days <= 30 && (
        <span className="font-normal">
          · {days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}
        </span>
      )}
    </span>
  );
}

export default function ProjectDocumentsPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // A PDF or a photo opens in the page's own viewer (2026-10-14) rather than a new tab, which most
  // browsers block when it is opened after a fetch; any other file is still saved.
  const { show, viewer } = useFileViewer();
  /**
   * Which kind the upload form is open for, or `null` when it is closed.
   *
   * A string — the empty one meaning "open, no kind chosen for me" — rather than two pieces of
   * state that could disagree about whether the form is showing.
   */
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /**
   * No `companyId` is passed, and that is deliberate.
   *
   * The server resolves the company from the caller's session and narrows it to their selected company
   * (019 FR-004), so there is nothing for a screen to send. This was already how every screen under
   * `/dashboard/projects` behaved; as of 019 Phase 4 it is how the whole application behaves, and the
   * provider that made it unusual here no longer exists.
   */
  const documents = useQuery({
    queryKey: ['project', projectId, 'documents'],
    queryFn: () => getProjectDocuments(projectId),
  });

  /**
   * The required set, for naming what is outstanding.
   *
   * Fetched here rather than threaded in: the same query key the settings screen uses, so the two
   * share one cached answer instead of asking twice.
   */
  const requirements = useQuery({
    queryKey: ['projectDocumentRequirements'],
    queryFn: () => getDocumentRequirements(),
  });

  const upload = useMutation({
    mutationFn: (input: {
      documentTypeId?: string;
      documentType: string;
      data: string;
      contentType: string;
      fileName?: string;
      documentNumber?: string;
      expiresAt?: string;
    }) => uploadProjectDocument(projectId, input),
    onSuccess: () => {
      setUploadFor(null);
      void queryClient.invalidateQueries({
        queryKey: ['project', projectId, 'documents'],
      });
      // The portfolio row carries this project's readiness, and it has just moved. Invalidated
      // by its root key because the list is cached per filter and page — a readiness figure that
      // disagrees with the project's own screen is the inconsistency 017 FR-008 exists to avoid.
      void queryClient.invalidateQueries({
        queryKey: ['projects', 'portfolio'],
      });
    },
  });

  const open = async (document: ProjectDocument) => {
    setDownloadError(null);
    try {
      // The server's own name for the file, with its extension — see `openStoredFile`. The
      // fallback is only reached if the response carried no readable `Content-Disposition`.
      show(
        await downloadProjectDocument(projectId, document.id),
        `${document.documentType}-${document.id}`,
      );
    } catch {
      setDownloadError(DOCUMENT_COPY.projectDocumentDownloadFailed);
    }
  };

  /** Saves the file under the server's own name — the companion to View (2026-10-15). */
  const download = async (document: ProjectDocument) => {
    setDownloadError(null);
    try {
      const file = await downloadProjectDocument(projectId, document.id);
      saveBlob(
        file.blob,
        file.filename ?? `${document.documentType}-${document.id}`,
      );
    } catch {
      setDownloadError(DOCUMENT_COPY.projectDocumentDownloadFailed);
    }
  };

  /**
   * Which required kinds this project holds nothing for.
   *
   * Computed from the documents and the required set rather than read from readiness, because
   * readiness carries *type ids* and this panel has to name the kinds — and it already has the
   * list that maps one to the other.
   */
  const held = new Set(
    (documents.data ?? [])
      .map((document) => document.documentTypeId)
      .filter((id): id is string => !!id),
  );
  const outstanding = (requirements.data?.requirements ?? []).filter(
    (requirement) => !held.has(requirement.documentTypeId),
  );

  /**
   * What may be filed here.
   *
   * `availableTypes` rather than `requirements`: the required set is what a project *owes*, and a
   * project may perfectly well hold a kind nobody requires of it. Falls back to the required set
   * for a server too old to send the wider list — an upload against the kinds it does know is
   * better than a form with nothing in it.
   *
   * `expires` comes from the kind itself (2026-10-09). It was hardcoded false because
   * `ProjectDocument` had no expiry column — so an insurance certificate filed here answered its
   * mandatory kind for ever, lapsed or not. The column exists now and `DocumentType.hasExpiry`
   * has always said which kinds lapse; this is simply passing it on.
   */
  const available = requirements.data?.availableTypes ?? [];
  const uploadKinds: UploadKind[] = (
    available.length > 0 ? available : (requirements.data?.requirements ?? [])
  ).map((type) => ({
    documentTypeId: type.documentTypeId,
    name: type.name,
    expires: type.hasExpiry,
  }));

  if (documents.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (documents.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  const rows = documents.data ?? [];
  const mandatoryKinds = new Set(
    (requirements.data?.requirements ?? [])
      .filter((requirement) => requirement.isMandatory)
      .map((requirement) => requirement.documentTypeId),
  );
  const mandatoryRows = rows.filter(
    (document) =>
      document.documentTypeId && mandatoryKinds.has(document.documentTypeId),
  );
  const optionalRows = rows.filter(
    (document) =>
      !document.documentTypeId || !mandatoryKinds.has(document.documentTypeId),
  );

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-gray-900">
          {DOCUMENT_COPY.projectDocumentsHeading}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {DOCUMENT_COPY.projectDocumentsHint}
        </p>
      </div>

      <FormError message={downloadError} />
      {viewer}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          {DOCUMENT_COPY.projectDocumentsEmpty}
        </p>
      ) : (
        <>
          {/* Mandatory first, then optional (2026-10-15) — the client: "under docs, can we show
              mandatory and optional docs". Mandatory is a kind the required set marks mandatory;
              everything else filed here — an advisory kind, a supplementary paper — is optional. */}
          {[
            { title: 'Mandatory documents', list: mandatoryRows },
            { title: 'Optional documents', list: optionalRows },
          ].map(
            (group) =>
              group.list.length > 0 && (
                <div key={group.title}>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">
                    {group.title}{' '}
                    <span className="font-normal text-gray-500">
                      ({group.list.length})
                    </span>
                  </h3>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {group.list.map((document) => (
                      <li
                        key={document.id}
                        className="flex flex-wrap items-start justify-between gap-2 p-3"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                            {document.documentType}
                            {document.expiresAt && (
                              <ExpiryPill expiresAt={document.expiresAt} />
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {/*
                              The name when there is one, the date alone when there is not. A
                              "Filed by —" with an em dash where a person belongs reads as missing
                              data; the date on its own reads as what it is.
                            */}
                            {document.uploadedByName
                              ? DOCUMENT_COPY.projectDocumentFiledBy(
                                  document.uploadedByName,
                                  dateTimeLabel(document.uploadedAt),
                                )
                              : DOCUMENT_COPY.projectDocumentFiledAt(
                                  dateTimeLabel(document.uploadedAt),
                                )}
                          </p>
                          {document.documentNumber && (
                            <p className="mt-0.5 text-xs text-gray-600">
                              {DOCUMENT_COPY.projectDocumentNumber(
                                document.documentNumber,
                              )}
                            </p>
                          )}
                          {document.remark && (
                            <p className="mt-0.5 break-words text-xs text-gray-600">
                              {document.remark}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {/* Only a lapsed one is badged: an expired mandatory paper no longer
                              counts towards readiness, and that is worth saying in red. */}
                          {hasLapsed(document) && document.documentTypeId && (
                            <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                              {DOCUMENT_COPY.projectDocumentExpiredBadge}
                            </span>
                          )}
                          <RowAction
                            intent="read"
                            type="button"
                            onClick={() => void open(document)}
                          >
                            View
                          </RowAction>
                          <RowAction
                            intent="read"
                            type="button"
                            onClick={() => void download(document)}
                          >
                            Download
                          </RowAction>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </>
      )}

      {outstanding.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <h3 className="text-sm font-medium text-amber-900">
            {DOCUMENT_COPY.projectDocumentsOutstandingHeading}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {outstanding.map((requirement) => (
              <li
                key={requirement.documentTypeId}
                className="break-words text-sm text-amber-900"
              >
                {/*
                  Named by consequence, the same wording rule the settings editor follows: a
                  missing mandatory kind would have refused this project's creation, a missing
                  advisory one is paperwork still being chased. Merging them would lose that.
                */}
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">
                    {requirement.isMandatory
                      ? DOCUMENT_COPY.projectDocumentsOutstandingMandatory(
                          requirement.name,
                        )
                      : DOCUMENT_COPY.projectDocumentsOutstandingAdvisory(
                          requirement.name,
                        )}
                  </span>
                  {/*
                    The way out of the sentence above. Naming what is missing and offering no way
                    to supply it is what this panel did for a year.
                  */}
                  <RowAction
                    type="button"
                    onClick={() => setUploadFor(requirement.documentTypeId)}
                  >
                    {DOCUMENT_COPY.projectDocumentFileThis}
                  </RowAction>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {uploadKinds.length === 0 ? null : uploadFor === null ? (
        <div>
          <Button type="button" onClick={() => setUploadFor('')}>
            {DOCUMENT_COPY.projectDocumentAdd}
          </Button>
        </div>
      ) : (
        <section className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            {DOCUMENT_COPY.projectDocumentAddHeading}
          </h3>
          <DocumentUpload
            /*
              Keyed on the preselected kind so opening the form from a different outstanding row
              remounts it. `DocumentUpload` reads `initialDocumentTypeId` into state once, which
              is right for a form that is opened and closed and wrong for one that stays mounted
              while the row it was opened from changes underneath it.
            */
            key={uploadFor}
            kinds={uploadKinds}
            initialDocumentTypeId={uploadFor || undefined}
            ownerLabel={DOCUMENT_COPY.projectDocumentOwnerLabel}
            // Both are stored against a project document as of 2026-10-09, and the expiry is
            // required on the kinds that declare one — `DocumentUpload` reads that off the kind.
            showDocumentNumber
            showExpiry
            hint={DOCUMENT_COPY.projectDocumentUploadHint}
            onUpload={(input) =>
              upload.mutateAsync({
                documentTypeId: input.documentTypeId,
                // The kind's own label, so the document reads the same here afterwards as it
                // does on the creation form — and survives the kind being renamed.
                documentType:
                  uploadKinds.find(
                    (kind) => kind.documentTypeId === input.documentTypeId,
                  )?.name ?? input.documentTypeId,
                data: input.data,
                contentType: input.contentType,
                fileName: input.fileName,
                documentNumber: input.documentNumber,
                expiresAt: input.expiresAt,
              })
            }
          />
          <div className="mt-3">
            <RowAction type="button" onClick={() => setUploadFor(null)}>
              {DOCUMENT_COPY.projectDocumentCancel}
            </RowAction>
          </div>
        </section>
      )}
    </section>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  downloadProjectDocument,
  getDocumentRequirements,
  getProjectDocuments,
  type ProjectDocument,
} from '@/app/lib/api/project-documents';
import { DOCUMENT_COPY, MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';

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
export default function ProjectDocumentsPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  const open = async (document: ProjectDocument) => {
    setDownloadError(null);
    try {
      const blob = await downloadProjectDocument(projectId, document.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Revoked on the next tick rather than immediately: the new tab needs the URL to still
      // resolve when it loads, and never revoking leaks the blob for the life of the page.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

  if (documents.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
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

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          {DOCUMENT_COPY.projectDocumentsEmpty}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {rows.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-start justify-between gap-2 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {document.documentType}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {/*
                    The name when there is one, the date alone when there is not. A "Filed by —"
                    with an em dash where a person belongs reads as missing data; the date on its
                    own reads as what it is.
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
                {document.remark && (
                  <p className="mt-0.5 break-words text-xs text-gray-600">
                    {document.remark}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span
                  className={
                    document.documentTypeId
                      ? 'whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900'
                      : 'whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
                  }
                >
                  {document.documentTypeId
                    ? DOCUMENT_COPY.projectDocumentRequiredBadge
                    : DOCUMENT_COPY.projectDocumentSupplementaryBadge}
                </span>
                <RowAction
                  intent="read"
                  type="button"
                  onClick={() => void open(document)}
                >
                  {DOCUMENT_COPY.projectDocumentOpen}
                </RowAction>
              </div>
            </li>
          ))}
        </ul>
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
                {requirement.isMandatory
                  ? DOCUMENT_COPY.projectDocumentsOutstandingMandatory(
                      requirement.name,
                    )
                  : DOCUMENT_COPY.projectDocumentsOutstandingAdvisory(
                      requirement.name,
                    )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

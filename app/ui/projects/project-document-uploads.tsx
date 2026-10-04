'use client';

import { useState } from 'react';

import {
  fileToBase64,
  stageProjectDocument,
  type ProjectDocumentRequirement,
} from '@/app/lib/api/project-documents';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { FormError } from '@/app/ui/settings/form-fields';

/**
 * One kind's staging state, as the form needs to reason about it.
 *
 * `stagedDocumentId` is the load-bearing field. Once a file is staged the *server* holds it, so a
 * creation refused for any reason — a missing kind, a duplicate name, a dropped connection — costs
 * the user nothing: the reference is still valid and the next submission reuses it. That is what
 * makes FR-023a's "preserve every file already supplied" true by construction rather than by
 * careful re-rendering (T073).
 */
export interface StagedUpload {
  fileName: string;
  stagedDocumentId: string;
}

export type StagedUploads = Record<string, StagedUpload>;

/** Per-kind progress, so one slow or failed upload is attributable (T074, T075). */
type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'failed'; fileName: string; message: string };

/**
 * A file per document kind, staged before the project exists (017 FR-023, FR-023a, FR-023b).
 *
 * ## Why the files are uploaded before the project
 *
 * FR-009 refuses to create a project while a mandatory kind has no document attached. The documents
 * therefore have to exist *before* the project does, which is what the staging path is for: each
 * file is uploaded on selection and returns a reference, and creation converts the references into
 * the project's documents inside the same transaction. A refused creation files nothing and creates
 * nothing.
 *
 * This ordering is also what makes the refusal survivable. Had the files travelled with the
 * creation request, every refusal would empty the file inputs — browsers do not let a page restore
 * a file selection — and the gate would punish the person complying with it. Staged, the references
 * outlive any number of refusals.
 *
 * ## Mandatory and advisory are named by consequence
 *
 * Not "required" and "optional" (FR-022a): the two differ in *effect*, one refusing creation and
 * the other merely reported outstanding, and a reader cannot see that from the word "optional".
 * The same wording rule the settings editor follows.
 */
export default function ProjectDocumentUploads({
  requirements,
  staged,
  onStagedChange,
  /** Type ids the server named in its last refusal, so each is said on its own control (T072). */
  missingTypeIds = [],
  companyId,
  disabled = false,
}: {
  requirements: ProjectDocumentRequirement[];
  staged: StagedUploads;
  onStagedChange: (next: StagedUploads) => void;
  missingTypeIds?: string[];
  companyId?: string;
  disabled?: boolean;
}) {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

  const setState = (documentTypeId: string, state: UploadState) =>
    setUploads((current) => ({ ...current, [documentTypeId]: state }));

  const choose = async (
    requirement: ProjectDocumentRequirement,
    file: File | undefined,
  ) => {
    if (!file) return;
    setState(requirement.documentTypeId, {
      status: 'uploading',
      fileName: file.name,
    });
    try {
      const { stagedDocumentId } = await stageProjectDocument(
        {
          documentTypeId: requirement.documentTypeId,
          // The kind's own name as the label, so the document reads the same on the project screen
          // afterwards as it did on this form.
          documentType: requirement.name,
          data: await fileToBase64(file),
          contentType: file.type || 'application/octet-stream',
          // Carried through the staging and the promotion, so the document downloads under the
          // name its uploader chose rather than `<kind>-<id>` with no extension.
          fileName: file.name,
        },
        companyId,
      );
      onStagedChange({
        ...staged,
        [requirement.documentTypeId]: {
          fileName: file.name,
          stagedDocumentId,
        },
      });
      setState(requirement.documentTypeId, { status: 'idle' });
    } catch (error) {
      // T075: a failure must be *visible on the control*. A form that holds submission closed for
      // a reason the user cannot see is indistinguishable from a broken form — and since a failed
      // upload leaves a mandatory kind unstaged, submission really will stay closed.
      setState(requirement.documentTypeId, {
        status: 'failed',
        fileName: file.name,
        message:
          error instanceof Error
            ? error.message
            : DOCUMENT_COPY.uploadFailed,
      });
    }
  };

  const remove = (documentTypeId: string) => {
    const next = { ...staged };
    delete next[documentTypeId];
    onStagedChange(next);
    setState(documentTypeId, { status: 'idle' });
  };

  if (requirements.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {DOCUMENT_COPY.creationNoneRequired}
      </p>
    );
  }

  const mandatory = requirements.filter((r) => r.isMandatory);
  const advisory = requirements.filter((r) => !r.isMandatory);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">{DOCUMENT_COPY.creationHint}</p>

      {[
        { rows: mandatory, isMandatory: true },
        { rows: advisory, isMandatory: false },
      ]
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <section key={String(group.isMandatory)} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {group.isMandatory
                ? DOCUMENT_COPY.creationMandatoryHeading
                : DOCUMENT_COPY.creationAdvisoryHeading}
            </h3>
            <p className="text-xs text-gray-500">
              {group.isMandatory
                ? DOCUMENT_COPY.strengthMandatoryHint
                : DOCUMENT_COPY.strengthAdvisoryHint}
            </p>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {group.rows.map((requirement) => {
                const state = uploads[requirement.documentTypeId] ?? {
                  status: 'idle' as const,
                };
                const attached = staged[requirement.documentTypeId];
                // T072: the server's refusal, said here rather than only in a summary the reader
                // then has to match against controls by name.
                const refused =
                  !attached &&
                  missingTypeIds.includes(requirement.documentTypeId);

                return (
                  <li
                    key={requirement.documentTypeId}
                    className="flex flex-col gap-1 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor={`doc-${requirement.documentTypeId}`}
                        className="text-sm font-medium text-gray-900"
                      >
                        {requirement.name}
                      </label>
                      {attached ? (
                        <div className="flex items-center gap-2">
                          <span className="break-all text-xs text-green-800">
                            {DOCUMENT_COPY.creationAttached(attached.fileName)}
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(requirement.documentTypeId)}
                            disabled={disabled}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          >
                            {DOCUMENT_COPY.creationReplace}
                          </button>
                        </div>
                      ) : (
                        <input
                          id={`doc-${requirement.documentTypeId}`}
                          type="file"
                          disabled={disabled || state.status === 'uploading'}
                          onChange={(event) =>
                            void choose(
                              requirement,
                              event.target.files?.[0] ?? undefined,
                            )
                          }
                          className="text-xs text-gray-700"
                        />
                      )}
                    </div>

                    {state.status === 'uploading' && (
                      <p className="text-xs text-gray-500" role="status">
                        {DOCUMENT_COPY.creationUploading(state.fileName)}
                      </p>
                    )}
                    {state.status === 'failed' && (
                      <FormError
                        message={DOCUMENT_COPY.creationUploadFailed(
                          state.fileName,
                          state.message,
                        )}
                      />
                    )}
                    {refused && (
                      <p className="text-xs font-medium text-red-700">
                        {DOCUMENT_COPY.creationRefusedHere}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

/**
 * Which mandatory kinds have nothing attached.
 *
 * Exported so the form can refuse submission without duplicating the rule — and so the refusal and
 * the controls cannot disagree about which kinds are outstanding.
 */
export function unstagedMandatory(
  requirements: ProjectDocumentRequirement[],
  staged: StagedUploads,
): ProjectDocumentRequirement[] {
  return requirements.filter(
    (requirement) => requirement.isMandatory && !staged[requirement.documentTypeId],
  );
}

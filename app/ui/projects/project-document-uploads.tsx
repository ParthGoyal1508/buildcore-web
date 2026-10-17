'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';

import {
  fileToBase64,
  stageProjectDocument,
  type ProjectDocumentRequirement,
} from '@/app/lib/api/project-documents';
import { errorMessage } from '@/app/lib/api/client';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import {
  ACCEPT_IMAGES_AND_PDF,
  MAX_UPLOAD_BYTES,
  compressImage,
  formatBytes,
  matchesAccept,
} from '@/app/lib/files';
import { dateLabel } from '@/app/lib/format';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * One kind's staging state, as the form needs to reason about it.
 *
 * `stagedDocumentId` is the load-bearing field. Once a file is staged the *server* holds it, so a
 * creation refused for any reason — a missing kind, a duplicate name, a dropped connection — costs
 * the user nothing: the reference is still valid and the next submission reuses it. That is what
 * makes FR-023a's "preserve every file already supplied" true by construction rather than by
 * careful re-rendering (T073).
 */
/** The API's document allow-list (036 B5): PDF, photos, Office xlsx/docx. */
const STAGED_DOCUMENT_ACCEPT = `${ACCEPT_IMAGES_AND_PDF},application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xlsx,.docx`;

export interface StagedUpload {
  fileName: string;
  stagedDocumentId: string;
  /** What was filed with it, so the row can show the date the document lapses on. */
  expiresAt?: string;
}

export type StagedUploads = Record<string, StagedUpload>;

/** Per-kind progress, so one slow or failed upload is attributable (T074, T075). */
type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'failed'; fileName: string; message: string };

/**
 * What has been typed against one kind but not yet sent (2026-10-12).
 *
 * The file is **held** rather than uploaded the instant it is chosen, because a kind that expires
 * cannot be staged without its date and the date may be typed second. Holding it is also what lets
 * the date be corrected afterwards: the bytes are still here, so the row re-stages with the new
 * date instead of asking somebody to find the file again.
 */
interface Pending {
  file?: File;
  expiresAt: string;
}

const emptyPending = (): Pending => ({ expiresAt: '' });

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
  /**
   * The parent's own setter.
   *
   * Typed as a setter rather than as `(next) => void` so every write here is an **update of what
   * is current** rather than of what was current when this render began. Two rows whose uploads
   * finish at nearly the same moment would otherwise both write a copy of the same older map, and
   * the second would silently drop the first's reference — leaving a file the server is holding
   * and the form has forgotten.
   */
  onStagedChange: Dispatch<SetStateAction<StagedUploads>>;
  missingTypeIds?: string[];
  companyId?: string;
  disabled?: boolean;
}) {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [pending, setPending] = useState<Record<string, Pending>>({});

  const setState = (documentTypeId: string, state: UploadState) =>
    setUploads((current) => ({ ...current, [documentTypeId]: state }));

  const pendingOf = (documentTypeId: string): Pending =>
    pending[documentTypeId] ?? emptyPending();

  /**
   * Records what was typed or chosen, and stages as soon as the kind's own rule is satisfied.
   *
   * **A kind that expires cannot be staged without its date** — the server refuses it, and said so
   * on this very form with no field to answer it in (reported 2026-10-12). So the file is held
   * until the date is there, and typing the date afterwards sends it: either order works, and
   * neither is a dead end.
   *
   * `force` distinguishes the two callers. Choosing a file always re-stages, because the bytes
   * have changed. Changing a date only re-stages when the date differs from what was filed with
   * the document already staged — a date input fires on its way to a complete value, and
   * re-uploading on each of those would be work nobody asked for.
   */
  const record = (
    requirement: ProjectDocumentRequirement,
    patch: Partial<Pending>,
    force: boolean,
  ) => {
    const next = { ...pendingOf(requirement.documentTypeId), ...patch };
    setPending((current) => ({
      ...current,
      [requirement.documentTypeId]: next,
    }));
    if (!next.file) return;
    const already = staged[requirement.documentTypeId];
    if (!force && already?.expiresAt === (next.expiresAt || undefined)) return;
    void stage(requirement, next);
  };

  const stage = async (
    requirement: ProjectDocumentRequirement,
    input: Pending,
  ) => {
    const original = input.file;
    if (!original) return;

    // 036 I25: checked against what the server accepts (its allow-list decides by the bytes) and
    // the 10 MB limit before anything is read, and a photographed certificate is shrunk first —
    // the server stores the type it detects, never the one claimed here.
    if (!matchesAccept(original, STAGED_DOCUMENT_ACCEPT)) {
      setState(requirement.documentTypeId, {
        status: 'failed',
        fileName: original.name,
        message: 'Upload a PDF, a photo, or an Excel or Word file.',
      });
      return;
    }
    const file = original.type.startsWith('image/')
      ? await compressImage(original)
      : original;
    if (file.size > MAX_UPLOAD_BYTES) {
      setState(requirement.documentTypeId, {
        status: 'failed',
        fileName: original.name,
        message: `It is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      });
      return;
    }

    // Asked for rather than attempted. The server would refuse this with the same rule, and a
    // refusal the form could have prevented reads as the form's fault — which, until this field
    // existed, it was.
    if (requirement.hasExpiry && !input.expiresAt) {
      setState(requirement.documentTypeId, {
        status: 'failed',
        fileName: file.name,
        message: DOCUMENT_COPY.creationExpiryFirst,
      });
      return;
    }

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
          expiresAt: input.expiresAt || undefined,
        },
        companyId,
      );
      onStagedChange((current) => ({
        ...current,
        [requirement.documentTypeId]: {
          fileName: file.name,
          stagedDocumentId,
          expiresAt: input.expiresAt || undefined,
        },
      }));
      setState(requirement.documentTypeId, { status: 'idle' });
    } catch (error) {
      // T075: a failure must be *visible on the control*. A form that holds submission closed for
      // a reason the user cannot see is indistinguishable from a broken form — and since a failed
      // upload leaves a mandatory kind unstaged, submission really will stay closed.
      setState(requirement.documentTypeId, {
        status: 'failed',
        fileName: file.name,
        message: errorMessage(error, DOCUMENT_COPY.uploadFailed),
      });
    }
  };

  const remove = (documentTypeId: string) => {
    onStagedChange((current) => {
      const next = { ...current };
      delete next[documentTypeId];
      return next;
    });
    // The typed date goes with the file it was filed against. Keeping it would offer the next
    // document a date somebody chose for a different one.
    setPending((current) => ({ ...current, [documentTypeId]: emptyPending() }));
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
                            {attached.expiresAt
                              ? DOCUMENT_COPY.creationAttachedUntil(
                                  attached.fileName,
                                  dateLabel(attached.expiresAt),
                                )
                              : DOCUMENT_COPY.creationAttached(
                                  attached.fileName,
                                )}
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
                          accept={STAGED_DOCUMENT_ACCEPT}
                          disabled={disabled || state.status === 'uploading'}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            // Cleared at once, so the same file picked again after a refusal
                            // fires a change (036 I25).
                            event.target.value = '';
                            if (file) record(requirement, { file }, true);
                          }}
                          className="text-xs text-gray-700"
                        />
                      )}
                    </div>

                    {/*
                      Only for a kind that lapses, and the kind itself says which those are. The
                      server refuses one of them with no date — this is the field that answers it,
                      and its absence is why a company requiring an expiring document could not
                      create a project at all.

                      Left editable after the file is attached: a date typed wrong is corrected
                      here, and the held file is re-staged with the new one rather than asking
                      somebody to find it again.
                    */}
                    {requirement.hasExpiry && (
                      <div className="max-w-[16rem]">
                        <TextField
                          id={`doc-expiry-${requirement.documentTypeId}`}
                          type="date"
                          label={DOCUMENT_COPY.creationExpiryLabel}
                          {...(attached
                            ? {}
                            : { hint: DOCUMENT_COPY.creationExpiryHint })}
                          disabled={disabled || state.status === 'uploading'}
                          value={pendingOf(requirement.documentTypeId).expiresAt}
                          onChange={(event) =>
                            record(
                              requirement,
                              { expiresAt: event.target.value },
                              false,
                            )
                          }
                        />
                      </div>
                    )}

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

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { decideApproval } from '@/app/lib/api/approvals';
import {
  type IssuedLetter,
  type LetterKind,
  composeLetter,
  downloadLetter,
  getLetterKindFields,
  getLetterKinds,
  getLetterPrefill,
  getLetters,
  getSignatories,
  issueLetter,
  previewComposedLetter,
  previewLetter,
} from '@/app/lib/api/letters';
import { GENERATE_LETTER_COPY, LETTER_COPY } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import ActionReview from '@/app/ui/approvals/action-review';
import StatusBadge from '@/app/ui/status-badge';

/**
 * The letters a project issues (025 FR-033).
 *
 * ## What was missing, exactly
 *
 * The letters module has permitted `letter_work_order`, `letter_loi` and
 * `letter_purchase_order` since feature 017, each mapped to `PROJECT_FINANCIALS` rather than
 * `PROJECTS` — because issuing a work order is a spending decision. Templates, signatories,
 * versioning and countersigned uploads were all built. **Nothing anywhere called `composeLetter`**,
 * so none of it could be reached, and the only letters surface in the application was recruitment's,
 * which uses a different and older API.
 *
 * ## The subject pair is opaque, deliberately
 *
 * A letter addresses `subjectType` + `subjectId` and the letters module never resolves the pair.
 * That is what lets a letter address a project without that module knowing what a project is — so
 * this screen passes `project` and the id, and asks for nothing else.
 *
 * ## The fields come from the kind, not from here
 *
 * Each kind declares its own tokens, and a field that renders blank in a signed letter is
 * indistinguishable from a deliberate omission. So the form is built from what the kind declares
 * rather than from a list typed here, and a kind whose fields change needs no change to this file.
 */
const PROJECT_KINDS = [
  'letter_work_order',
  'letter_loi',
  'letter_purchase_order',
];

/**
 * The order the typed fields read in on the letter (2026-10-14). The API lists a kind's fields by
 * token, which put "Completion by" first and "Issued to" last — the reverse of how anybody fills in
 * a work order. A token not listed here keeps the API's order, after these.
 */
const FIELD_ORDER = [
  'vendorName',
  'vendorAddress',
  'scope',
  'orderValue',
  'completionDate',
  'paymentTerms',
  'termsAndConditions',
];

/** Free text that runs to several lines — an address, a scope, a set of payment terms. */
const MULTI_LINE = new Set([
  'vendorAddress',
  'scope',
  'paymentTerms',
  'termsAndConditions',
]);

/**
 * Fields read from a record that are still offered for editing (2026-10-14). The terms come from
 * Settings → Terms for this kind of document, and a particular order sometimes needs a clause
 * changed — edited here, for this letter, without touching the company's standard set.
 */
const EDITABLE_FROM_RECORD = new Set(['termsAndConditions']);

export default function ProjectLetters({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState<LetterKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A composed letter's draft, open for reading before it is approved or issued. */
  const [previewing, setPreviewing] = useState<{
    title: string;
    blob: Blob;
  } | null>(null);

  const kinds = useQuery({
    queryKey: ['letter-kinds'],
    queryFn: () => getLetterKinds(),
  });

  const letters = useQuery({
    queryKey: ['letters', 'project', projectId],
    queryFn: () =>
      getLetters({ subjectType: 'project', subjectId: projectId }),
  });

  const projectKinds = (kinds.data ?? []).filter(
    (kind) => PROJECT_KINDS.includes(kind.key) && kind.isActive,
  );

  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: ['letters', 'project', projectId],
    });

  const download = async (letter: IssuedLetter) => {
    try {
      const blob = await downloadLetter(letter.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${letter.referenceNo ?? letter.letterKindLabel}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('That letter could not be downloaded.');
    }
  };

  const preview = async (letter: IssuedLetter) => {
    setError(null);
    try {
      setPreviewing({
        title: `${letter.letterKindLabel} — draft`,
        blob: await previewComposedLetter(letter.id),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'That letter could not be previewed.',
      );
    }
  };

  const issue = async (letter: IssuedLetter) => {
    setError(null);
    try {
      await issueLetter(letter.id, {});
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'That letter could not be issued.',
      );
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Letters</h2>
        <p className="text-sm text-gray-600">
          Work orders, letters of intent and purchase orders issued on this
          project. Each is versioned: reissuing supersedes rather than replaces,
          so what was sent stays readable.
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {projectKinds.length === 0 ? (
          <p className="text-sm text-gray-600">
            No project letter kind is defined. They are configured in settings
            rather than released.
          </p>
        ) : (
          projectKinds.map((kind) => (
            <Button key={kind.id} onClick={() => setComposing(kind)}>
              Issue a {kind.label.toLowerCase()}
            </Button>
          ))
        )}
      </div>

      {composing && (
        <ComposeLetter
          kind={composing}
          projectId={projectId}
          onClose={() => setComposing(null)}
          onIssued={() => {
            setComposing(null);
            refresh();
          }}
          onComposed={refresh}
        />
      )}

      {previewing && (
        <PdfPreview
          title={previewing.title}
          blob={previewing.blob}
          onClose={() => setPreviewing(null)}
        />
      )}

      {letters.isLoading ? (
        <p className="text-sm text-gray-500">Loading letters…</p>
      ) : (letters.data ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No letter has been issued on this project.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(letters.data ?? []).map((letter) => {
                // A composed letter has no document yet (2026-10-14). While its chain is running it
                // is decided here, by whoever's turn it is; once approved — or where nothing gates
                // it — it is issued here. Download is offered only for what has been issued.
                const approval = letter.approval;
                const awaiting =
                  letter.status === 'composed' &&
                  approval !== null &&
                  approval.state !== 'approved';
                return (
                  <tr key={letter.id} className="align-top">
                    <td className="px-3 py-2">
                      {letter.letterKindLabel}
                      {letter.referenceNo && (
                        <span className="block text-xs text-gray-500">
                          {letter.referenceNo}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={letter.status} />
                      {awaiting && approval && (
                        <div className="mt-2 max-w-md">
                          <ActionReview
                            state={approval}
                            entityLabel={letter.letterKindLabel.toLowerCase()}
                            size="full"
                            onDecide={async (action, reason) => {
                              await decideApproval(approval.instanceId, {
                                action,
                                reason,
                              });
                              refresh();
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {letter.issuedAt
                        ? dateLabel(String(letter.issuedAt))
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {letter.status === 'composed' ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            intent="write"
                            onClick={() => void preview(letter)}
                          >
                            Preview
                          </Button>
                          {awaiting ? (
                            <span className="text-xs text-gray-500">
                              Issued once approved
                            </span>
                          ) : (
                            <Button onClick={() => void issue(letter)}>
                              Issue
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button onClick={() => void download(letter)}>
                          Download
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * One letter being composed.
 *
 * **A gated kind comes back `composed` rather than `issued`, and that is not an error.** The letter
 * is waiting on a person; rendering it as a failure would send somebody to raise it again.
 */
function ComposeLetter({
  kind,
  projectId,
  onClose,
  onIssued,
  onComposed,
}: {
  kind: LetterKind;
  projectId: string;
  onClose: () => void;
  onIssued: () => void;
  /** A gated letter was composed: it is in the list now, waiting on its approval. */
  onComposed: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatoryId, setSignatoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fields = useQuery({
    queryKey: ['letter-kind-fields', kind.id],
    queryFn: () => getLetterKindFields(kind.id),
  });

  // Only the manual ones: everything else the server reads from its own source, and offering a box
  // for a value the server will overwrite teaches people their typing does not matter.
  // What the records say for each field — the terms, from Settings — so an editable one opens
  // filled in rather than empty.
  const prefill = useQuery({
    queryKey: ['letter-prefill', kind.key, 'project', projectId],
    queryFn: () =>
      getLetterPrefill({
        letterKindKey: kind.key,
        subjectType: 'project',
        subjectId: projectId,
      }),
  });
  const recordValue = (token: string) =>
    prefill.data?.fields.find((f) => f.token === token)?.value ?? '';

  const rank = (token: string) => {
    const at = FIELD_ORDER.indexOf(token);
    return at === -1 ? FIELD_ORDER.length : at;
  };
  const manual = (fields.data ?? [])
    .filter(
      (field) =>
        field.sourceType === 'manual' || EDITABLE_FROM_RECORD.has(field.token),
    )
    .sort((a, b) => rank(a.token) - rank(b.token));
  const valueOf = (token: string) =>
    values[token] ??
    (EDITABLE_FROM_RECORD.has(token) ? recordValue(token) : '');

  // A work order, LOI or purchase order is signed (2026-10-14). This composer never asked who signs,
  // so every one of them was refused by the server with "a signatory must be named" — whether or not
  // the company had a signatory set up.
  const signatories = useQuery({
    queryKey: ['signatories'],
    queryFn: () => getSignatories(),
    enabled: kind.requiresSignature,
  });
  const active = (signatories.data ?? []).filter((s) => s.isActive);
  const chosenSignatory = signatoryId || active[0]?.id || '';
  const noSignatory =
    kind.requiresSignature && signatories.isSuccess && active.length === 0;

  const input = () => ({
    letterKindKey: kind.key,
    subjectType: 'project',
    subjectId: projectId,
    // Only what was edited is sent. An untouched field is read from its record at issue, so a
    // letter waiting on approval picks up a change made in Settings in the meantime.
    variables: values,
    ...(kind.requiresSignature && chosenSignatory
      ? { signatoryId: chosenSignatory }
      : {}),
  });

  // The letter as it would be issued, before anything is written — marked DRAFT, with no
  // reference and no signature graphic. A blank required field prints as its label in brackets.
  const showPreview = async () => {
    setPreviewBusy(true);
    setError(null);
    try {
      setDraft(await previewLetter(input()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'The preview could not be produced.',
      );
    } finally {
      setPreviewBusy(false);
    }
  };

  const compose = useMutation({
    mutationFn: () => composeLetter(input()),
    onSuccess: (letter) => {
      setError(null);
      if (letter.status === 'issued') {
        onIssued();
      } else {
        setNotice(
          'Composed, and waiting on an approval. It is not issued yet, and raising it again would make a second one.',
        );
        onComposed();
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        compose.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-gray-900">{kind.label}</h3>

      {fields.isLoading ? (
        <p className="text-sm text-gray-500">Reading the kind&rsquo;s fields…</p>
      ) : manual.length === 0 ? (
        <p className="text-sm text-gray-600">
          This kind fills itself from the project and needs nothing typed.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {manual.map((field) => {
            const multiLine = MULTI_LINE.has(field.token);
            const isTerms = field.token === 'termsAndConditions';
            const common = {
              required: field.isRequired,
              value: valueOf(field.token),
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) =>
                setValues((current) => ({
                  ...current,
                  [field.token]: event.target.value,
                })),
              className: 'rounded-md border border-gray-300 px-3 py-2',
            };
            return (
              <label
                key={field.token}
                className={`flex flex-col gap-1 text-sm${
                  multiLine ? ' sm:col-span-2' : ''
                }`}
              >
                <span className="font-medium text-gray-700">
                  {field.label}
                  {field.isRequired && <span className="text-red-600"> *</span>}
                </span>
                {isTerms && (
                  <span className="text-xs text-gray-500">
                    From Settings → Terms and conditions. Changes here apply to this letter only.
                  </span>
                )}
                {multiLine ? (
                  <textarea rows={isTerms ? 10 : 3} {...common} />
                ) : (
                  <input {...common} />
                )}
              </label>
            );
          })}
        </div>
      )}

      {kind.requiresSignature &&
        (noSignatory ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {GENERATE_LETTER_COPY.noSignatories}
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            <span className="font-medium text-gray-700">Signatory</span>
            <select
              required
              value={chosenSignatory}
              onChange={(event) => setSignatoryId(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {LETTER_COPY.signatoryRequired}
            </span>
          </label>
        ))}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900" role="status">
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          intent="write"
          disabled={previewBusy || noSignatory}
          onClick={() => void showPreview()}
        >
          {previewBusy ? 'Preparing…' : draft ? 'Refresh preview' : 'Preview'}
        </Button>
        <Button type="submit" disabled={compose.isPending || noSignatory}>
          {compose.isPending ? 'Issuing…' : 'Issue'}
        </Button>
        <Button type="button" intent="write" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {draft && (
        <PdfPreview
          title={`${kind.label} — draft`}
          blob={draft}
          onClose={() => setDraft(null)}
        />
      )}
    </form>
  );
}

/**
 * A PDF shown in the page (2026-10-14) — a preview is read beside the form it came from, and a new
 * tab opened after a request is one most browsers block. The object URL is released on close.
 */
function PdfPreview({
  title,
  blob,
  onClose,
}: {
  title: string;
  blob: Blob;
  onClose: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-blue-700 underline"
        >
          Close preview
        </button>
      </div>
      <p className="text-xs text-gray-500">
        A draft: no reference number, and the signature is applied only when
        the letter is issued.
      </p>
      <iframe
        title={title}
        src={url}
        className="h-[75vh] w-full rounded border border-gray-200"
      />
    </div>
  );
}

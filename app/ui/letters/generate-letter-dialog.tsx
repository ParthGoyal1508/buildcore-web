'use client';

import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  LETTER_REQUIRED_FIELD_UNRESOLVED,
  composeLetter,
  downloadLetter,
  getLetterKinds,
  getLetterPrefill,
  getSignatories,
  letterFileName,
  previewLetter,
  type IssuedLetter,
  type LetterKind,
  type PrefilledLetterField,
} from '@/app/lib/api/letters';
import { getCurrentUser, type CurrentUser } from '@/app/lib/api/users';
import {
  GENERATE_LETTER_COPY as COPY,
  HR_LETTER_KIND_PERMISSIONS,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import QueryError from '@/app/ui/query-error';
import {
  FormError,
  SecondaryButton,
  SelectField,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { LoadingText } from '@/app/ui/spinner';

/** Who the document is to — exactly one of the two. */
export type LetterRecipient = { employeeId: string } | { candidateId: string };

/** What the form hands to whoever issues the letter. */
export interface LetterSubmission {
  letterKindKey: string;
  /** Only the overrides: values changed from the pre-fill, plus typed manual fields. */
  variables: Record<string, string>;
  signatoryId?: string;
}

/**
 * Issues the letter and answers with it. Defaults to `POST /letters`; the offer letter plugs in
 * `POST /recruitment/offers/:id/generate` instead, because issuing an offer also moves the offer
 * and the candidate on, and a letter issued beside it would leave the offer a draft.
 */
export type LetterSubmit = (
  submission: LetterSubmission,
) => Promise<IssuedLetter>;

/** A refusal a custom `submit` words itself; shown verbatim, unlike an unexpected error. */
export class LetterSubmitError extends Error {}

/**
 * Whether this caller may be offered a kind. Mirrors the api's per-kind check (it reads
 * `permissions`, not grant levels); a kind with no known permission is offered and left
 * to the server, which refuses with `LETTER_KIND_FORBIDDEN` if it must.
 */
function mayOffer(user: CurrentUser | undefined, key: string): boolean {
  const permission = HR_LETTER_KIND_PERMISSIONS[key];
  if (!permission) return true;
  return (user?.permissions ?? []).includes(permission as never);
}

/**
 * What a kind is called when `GET /letter-kinds` cannot be read.
 *
 * Anyone holding a letter-issuing permission may read it (since 2026-10-14), so this is only for a
 * failed request: the menu still offers the keys by their usual names rather than nothing, and the
 * api's prefill names the kind properly once one is chosen.
 */
const FALLBACK_KIND_LABELS: Record<string, string> = {
  offer: 'Offer letter',
  appointment: 'Appointment letter',
  confirmation: 'Confirmation letter',
  increment: 'Increment letter',
  transfer: 'Transfer letter',
  experience: 'Experience letter',
  relieving: 'Relieving letter',
  termination: 'Termination letter',
  fnf_settlement: 'Full & final (F&F) settlement sheet',
  suspension: 'Suspension letter',
};

/**
 * The active kinds among `kindKeys` this caller may issue, in `kindKeys` order.
 *
 * Exported so a screen can decide whether to show its "Generate document" control at all —
 * offering a button that opens onto "nothing available" is the dead end this avoids.
 *
 * When the kinds cannot be listed, the keys are offered by their usual names
 * with `requiresSignature` unknown and taken as false; the api's `SIGNATORY_REQUIRED` refusal is
 * then what tells the user, verbatim.
 */
export function useOfferableLetterKinds(
  kindKeys: readonly string[],
  enabled = true,
) {
  const active = enabled && kindKeys.length > 0;
  const kinds = useQuery({
    queryKey: ['letter-kinds'],
    queryFn: () => getLetterKinds(),
    enabled: active,
    retry: false,
  });
  const user = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: active,
  });
  if (!active) return { kinds: [] as LetterKind[], isPending: false };

  const byKey = new Map((kinds.data ?? []).map((kind) => [kind.key, kind]));
  const fallback = (key: string): LetterKind | undefined =>
    kinds.isError
      ? {
          id: key,
          key,
          label: FALLBACK_KIND_LABELS[key] ?? key,
          requiresSignature: false,
          requiresApproval: false,
          approvalActionType: null,
          isActive: true,
          isShipped: true,
        }
      : undefined;
  const offerable = kindKeys
    .map((key) => byKey.get(key) ?? fallback(key))
    .filter(
      (kind): kind is LetterKind =>
        !!kind && kind.isActive && mayOffer(user.data, kind.key),
    );
  return { kinds: offerable, isPending: kinds.isPending || user.isPending };
}

/**
 * 036 J3 (2026-10-17): the fields that hold a paragraph rather than a phrase — an address, the
 * responsibilities of a post, a reason for leaving, the particulars of a settlement. Decided once
 * when the form opens (by token, or by a pre-filled value already too long for one line), never
 * while typing: the box used to turn from an input into a textarea at the 81st character, and the
 * swap threw the cursor out of the field mid-word.
 */
const PARAGRAPH_TOKEN =
  /address|responsibilit|reason|remark|detail|particulars|benefits|basis|scope|terms|duties|notes?$/i;

/** What the employee record fills in when it holds no gender (2026-10-15). */
const NEUTRAL_FORMS: Record<string, string> = {
  relation: 'S/o / D/o',
  pronounSubject: 'they',
  pronounObject: 'them',
  pronounPossessive: 'their',
};
const MALE_FORMS: Record<string, string> = {
  relation: 'S/o',
  pronounSubject: 'he',
  pronounObject: 'him',
  pronounPossessive: 'his',
};
const FEMALE_FORMS: Record<string, string> = {
  relation: 'D/o',
  pronounSubject: 'she',
  pronounObject: 'her',
  pronounPossessive: 'her',
};

/**
 * A salutation typed over a record that holds no gender decides the relation and pronouns the
 * record left neutral (2026-10-15): typing "Mr." turns "S/o / D/o" into "S/o" and "them" into
 * "him". Only fields still showing the record's neutral value, or a form this put there, follow
 * it — anything HR typed into them stays.
 */
function followSalutation(
  values: Record<string, string>,
  original: Record<string, string>,
): Record<string, string> {
  const s = (values.salutation ?? '').trim().toLowerCase().replace(/\.$/, '');
  const forms =
    s === 'mr'
      ? MALE_FORMS
      : ['ms', 'mrs', 'miss'].includes(s)
        ? FEMALE_FORMS
        : NEUTRAL_FORMS;
  const out = { ...values };
  for (const key of Object.keys(NEUTRAL_FORMS)) {
    if (!(key in out) || original[key] !== NEUTRAL_FORMS[key]) continue;
    const current = out[key];
    if (
      current === NEUTRAL_FORMS[key] ||
      current === MALE_FORMS[key] ||
      current === FEMALE_FORMS[key]
    ) {
      out[key] = forms[key];
    }
  }
  return out;
}

/**
 * Generate an HR document on demand: pick the kind, check the form the records filled in, issue,
 * download (HR documents, 2026-10-13).
 *
 * ## The form is the api's, pre-filled
 *
 * `GET /letters/prefill` returns every field the kind declares with the value the employee,
 * candidate and company records give it. Those open under "From records", still editable — HR may
 * correct anything for this one letter — and the blanks open under "To fill in". The grouping is
 * fixed when the form loads, so a field does not jump sections while somebody types into it.
 *
 * ## Only overrides are sent
 *
 * The api re-reads the records at compose, so sending back every pre-filled value would freeze
 * them as typed text for no reason. What goes in `variables` is what the user changed from the
 * pre-fill, plus anything typed into a field nothing on record holds. A pre-filled value that was
 * cleared is not sent: the api treats an empty value as "use the record", so a blank cannot be
 * forced into a letter by deleting a field — the record's value prints instead.
 *
 * ## Refusals land on the field
 *
 * `LETTER_REQUIRED_FIELD_UNRESOLVED` names the tokens in `fields`; each is marked where it is,
 * not only listed in the banner. Every other refusal is shown verbatim.
 */
export default function GenerateLetterDialog({
  recipient,
  recipientLabel,
  kindKeys,
  initialKindKey,
  onClose,
  onIssued,
  submit,
}: {
  recipient: LetterRecipient;
  /** Whose document, for the dialog title — the screen behind already knows. */
  recipientLabel?: string;
  kindKeys: readonly string[];
  /** Opens straight onto one kind, e.g. `increment` after recording a revision. */
  initialKindKey?: string;
  onClose: () => void;
  onIssued?: (letter: IssuedLetter) => void;
  /** Overrides how the letter is issued; see `LetterSubmit`. */
  submit?: LetterSubmit;
}) {
  const queryClient = useQueryClient();
  const { kinds, isPending: kindsPending } = useOfferableLetterKinds(kindKeys);
  const [kindKey, setKindKey] = useState(initialKindKey ?? '');
  const kind = kinds.find((k) => k.key === kindKey) ?? null;

  const [issued, setIssued] = useState<IssuedLetter | null>(null);

  const title = recipientLabel
    ? `${COPY.title} — ${recipientLabel}`
    : COPY.title;

  return (
    <Modal title={title} onClose={onClose} wide>
      {issued ? (
        <IssuedSummary letter={issued} onClose={onClose} />
      ) : (
        <div className="flex flex-col gap-5">
          {kindsPending ? (
            <p className="text-sm text-gray-500" role="status">
              <LoadingText />
            </p>
          ) : kinds.length === 0 ? (
            <p className="text-sm text-gray-600">{COPY.noKinds}</p>
          ) : (
            <SelectField
              id="generate-letter-kind"
              label={COPY.chooseKind}
              value={kindKey}
              onChange={(e) => setKindKey(e.target.value)}
            >
              <option value="">Choose…</option>
              {kinds.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </SelectField>
          )}

          {kind && (
            // Keyed on the kind, so switching kinds starts a fresh form rather than carrying one
            // kind's typed values into another's fields of the same name.
            <LetterForm
              key={kind.key}
              kind={kind}
              recipient={recipient}
              submit={
                submit ?? ((input) => composeLetter({ ...input, ...recipient }))
              }
              onCancel={onClose}
              onIssued={(letter) => {
                setIssued(letter);
                void queryClient.invalidateQueries({ queryKey: ['letters'] });
                onIssued?.(letter);
              }}
            />
          )}

          {!kind && (
            <div className="flex justify-end">
              <SecondaryButton type="button" onClick={onClose}>
                Cancel
              </SecondaryButton>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function LetterForm({
  kind,
  recipient,
  submit,
  onCancel,
  onIssued,
}: {
  kind: LetterKind;
  recipient: LetterRecipient;
  submit: LetterSubmit;
  onCancel: () => void;
  onIssued: (letter: IssuedLetter) => void;
}) {
  const prefill = useQuery({
    queryKey: ['letters', 'prefill', kind.key, recipient],
    queryFn: () => getLetterPrefill({ letterKindKey: kind.key, ...recipient }),
    // The records may have changed since this form was last opened — a revision just recorded
    // is the common case — so never open on a cached pre-fill.
    staleTime: 0,
    gcTime: 0,
  });

  const signatories = useQuery({
    queryKey: ['signatories'],
    queryFn: () => getSignatories(),
    enabled: kind.requiresSignature,
    // `SETTINGS` guards this list; without it the picker says so rather than retrying a 403.
    retry: false,
  });
  const activeSignatories = (signatories.data ?? []).filter((s) => s.isActive);

  if (prefill.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (prefill.isError) {
    // 036 J1 (2026-10-17): with a Retry — the form could only be got back by closing the dialog.
    return (
      <QueryError
        error={prefill.error}
        fallback={COPY.prefillFailed}
        onRetry={prefill.refetch}
      />
    );
  }

  return (
    <LetterFields
      kind={kind}
      submit={submit}
      preview={(submission) => previewLetter({ ...submission, ...recipient })}
      fields={prefill.data.fields}
      signatories={activeSignatories}
      signatoriesPending={kind.requiresSignature && signatories.isPending}
      signatoriesError={
        kind.requiresSignature && signatories.isError
          ? signatories.error instanceof ApiError &&
            signatories.error.status === 403
            ? COPY.signatoriesForbidden
            : COPY.signatoriesFailed
          : null
      }
      onCancel={onCancel}
      onIssued={onIssued}
    />
  );
}

function LetterFields({
  kind,
  submit,
  preview,
  fields,
  signatories,
  signatoriesPending,
  signatoriesError,
  onCancel,
  onIssued,
}: {
  kind: LetterKind;
  submit: LetterSubmit;
  /** The letter as it would be issued, from what is in the form now — writes nothing. */
  preview: (submission: LetterSubmission) => Promise<Blob>;
  fields: PrefilledLetterField[];
  signatories: { id: string; name: string; title: string }[];
  signatoriesPending: boolean;
  signatoriesError: string | null;
  onCancel: () => void;
  onIssued: (letter: IssuedLetter) => void;
}) {
  // What the records said when the form opened — the baseline "changed" is measured against.
  const [original] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.token, f.value])),
  );
  const [values, setValues] = useState<Record<string, string>>(original);
  const [signatoryId, setSignatoryId] = useState('');
  const [flagged, setFlagged] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paragraphs] = useState(
    () =>
      new Set(
        fields
          .filter((f) => PARAGRAPH_TOKEN.test(f.token) || f.value.length > 80)
          .map((f) => f.token),
      ),
  );
  // 036 J2 (2026-10-17): the draft read before anything is issued, in the page's own viewer. There
  // was no preview here at all — the first sight of the letter was the issued, numbered one.
  const { view, viewer } = useFileViewer();

  const fromRecords = fields.filter(
    (f) => f.sourceType !== 'manual' && f.value.trim() !== '',
  );
  const toFill = fields.filter(
    (f) => !(f.sourceType !== 'manual' && f.value.trim() !== ''),
  );

  const effectiveSignatory = signatoryId || signatories[0]?.id || '';

  const overrides = () => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      const value = (values[f.token] ?? '').trim();
      if (!value) continue;
      if (f.sourceType === 'manual' || value !== original[f.token].trim()) {
        out[f.token] = value;
      }
    }
    return out;
  };

  const submission = (): LetterSubmission => ({
    letterKindKey: kind.key,
    variables: overrides(),
    signatoryId: kind.requiresSignature ? effectiveSignatory : undefined,
  });

  const showDraft = () =>
    void view({
      title: `${kind.label} — draft`,
      fileName: `${kind.label} (draft).pdf`,
      load: () => preview(submission()),
    });

  const issue = async () => {
    setError(null);
    // A required field nobody can supply: blank now, and blank in the records it came from —
    // the api would refuse it, so say so on the field without the round trip.
    const missing = fields
      .filter(
        (f) =>
          f.isRequired && !(values[f.token] ?? '').trim() && !f.value.trim(),
      )
      .map((f) => f.token);
    if (missing.length > 0) {
      setFlagged(missing);
      setError(
        `Still needed: ${fields
          .filter((f) => missing.includes(f.token))
          .map((f) => f.label)
          .join(', ')}.`,
      );
      return;
    }
    if (kind.requiresSignature && !effectiveSignatory) {
      setError(COPY.noSignatories);
      return;
    }
    setFlagged([]);
    // 036 J3 (2026-10-17): an ungated kind is issued by this call and numbered for good, so it asks
    // first. One that goes for approval is numbered only when it is finally issued.
    if (!kind.requiresApproval) {
      const ok = await confirmDialog({
        title: `Issue this ${kind.label.toLowerCase()}?`,
        message:
          'Issuing gives it a permanent reference number, and it cannot be edited afterwards — a correction means reissuing it as a new version. Preview it first if you have not.',
        confirmLabel: COPY.issue,
        tone: 'default',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const letter = await submit(submission());
      onIssued(letter);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === LETTER_REQUIRED_FIELD_UNRESOLVED) {
          const named = err.details?.fields;
          if (Array.isArray(named)) setFlagged(named.map(String));
        }
        setError(err.message || COPY.issueFailed);
      } else if (err instanceof LetterSubmitError) {
        setError(err.message);
      } else {
        setError(COPY.issueFailed);
      }
      // Typed values are kept: retyping a letter because the api refused it is the worst thing
      // this form could do to somebody.
    } finally {
      setBusy(false);
    }
  };

  const renderField = (f: PrefilledLetterField) => {
    const id = `letter-field-${f.token}`;
    const isFlagged = flagged.includes(f.token);
    const changed =
      f.sourceType !== 'manual' &&
      f.value.trim() !== '' &&
      (values[f.token] ?? '').trim() !== f.value.trim() &&
      (values[f.token] ?? '').trim() !== '';
    const value = values[f.token] ?? '';
    const long = paragraphs.has(f.token);
    const common = {
      id,
      value,
      'aria-invalid': isFlagged ? true : undefined,
      'aria-describedby': isFlagged ? `${id}-error` : undefined,
      className: clsx(fieldClass, isFlagged && 'border-red-500'),
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        const next = e.target.value;
        setValues((prev) =>
          f.token === 'salutation'
            ? followSalutation({ ...prev, salutation: next }, original)
            : { ...prev, [f.token]: next },
        );
        if (isFlagged && next.trim()) {
          setFlagged((prev) => prev.filter((t) => t !== f.token));
        }
      },
    };
    return (
      <div key={f.token} className={long ? 'sm:col-span-2' : undefined}>
        <label
          htmlFor={id}
          className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          <span>
            {f.label}
            {f.isRequired && (
              <span className="text-red-600" aria-hidden="true">
                {' '}
                *
              </span>
            )}
            {f.isRequired && <span className="sr-only"> (required)</span>}
          </span>
          {changed && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-normal text-amber-800">
              edited
            </span>
          )}
        </label>
        {long ? (
          <textarea rows={3} {...common} />
        ) : (
          <input type="text" {...common} />
        )}
        {isFlagged && (
          <p
            id={`${id}-error`}
            className="mt-1 text-xs text-red-600"
            role="alert"
          >
            {COPY.requiredMissing}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {fields.length === 0 && (
        <p className="text-sm text-gray-600">{COPY.noFields}</p>
      )}

      {fromRecords.length > 0 && (
        <section aria-labelledby="letter-from-records">
          <h3
            id="letter-from-records"
            className="text-sm font-medium text-gray-900"
          >
            {COPY.fromRecords}
          </h3>
          <p className="mb-3 text-xs text-gray-500">{COPY.fromRecordsHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fromRecords.map(renderField)}
          </div>
        </section>
      )}

      {toFill.length > 0 && (
        <section aria-labelledby="letter-to-fill">
          <h3 id="letter-to-fill" className="text-sm font-medium text-gray-900">
            {COPY.toFill}
          </h3>
          <p className="mb-3 text-xs text-gray-500">{COPY.toFillHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {toFill.map(renderField)}
          </div>
        </section>
      )}

      {kind.requiresSignature &&
        (signatoriesPending ? (
          <p className="text-sm text-gray-500" role="status">
            Loading signatories…
          </p>
        ) : signatories.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {signatoriesError ?? COPY.noSignatories}
          </p>
        ) : (
          <SelectField
            id="generate-letter-signatory"
            label={COPY.signatory}
            value={effectiveSignatory}
            onChange={(e) => setSignatoryId(e.target.value)}
          >
            {signatories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.title}
              </option>
            ))}
          </SelectField>
        ))}

      <FormError message={error} />
      {viewer}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <SecondaryButton type="button" disabled={busy} onClick={showDraft}>
          Preview
        </SecondaryButton>
        {/*
          `intent="read"` because the route's write permission is the wrong gate here: whether
          this may be issued is the *kind's* permission (an increment is PAYROLL on an HR route),
          and the kinds offered above are already filtered by it. The api checks it again.
        */}
        <Button
          intent="read"
          type="button"
          loading={busy}
          disabled={kind.requiresSignature && signatories.length === 0}
          onClick={() => void issue()}
        >
          {busy
            ? 'Issuing…'
            : kind.requiresApproval
              ? COPY.submitForApproval
              : COPY.issue}
        </Button>
      </div>
    </div>
  );
}

function IssuedSummary({
  letter,
  onClose,
}: {
  letter: IssuedLetter;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The letter just issued, read in the page before (or instead of) saving it (2026-10-14).
  const { view, viewer } = useFileViewer();

  const download = async () => {
    setError(null);
    setBusy(true);
    try {
      saveBlob(await downloadLetter(letter.id), letterFileName(letter));
    } catch (err) {
      setError(
        err instanceof ApiError && err.code ? err.message : COPY.downloadFailed,
      );
    } finally {
      setBusy(false);
    }
  };

  const awaiting = letter.status === 'composed';

  return (
    <div className="flex flex-col gap-4">
      {awaiting ? (
        <p
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {COPY.awaitingApproval}
        </p>
      ) : (
        <div
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3"
          role="status"
        >
          <p className="text-sm text-green-900">
            {letter.letterKindLabel} {COPY.issued.toLowerCase()}.
          </p>
          {letter.referenceNo && (
            <p className="mt-1 text-sm text-green-900">
              Reference no.{' '}
              <span className="font-mono font-semibold">
                {letter.referenceNo}
              </span>
            </p>
          )}
        </div>
      )}
      <FormError message={error} />
      {viewer}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SecondaryButton type="button" onClick={onClose}>
          Done
        </SecondaryButton>
        {!awaiting && (
          <SecondaryButton
            type="button"
            onClick={() =>
              void view({
                title: letter.referenceNo ?? letter.letterKindLabel,
                fileName: letterFileName(letter),
                load: () => downloadLetter(letter.id),
              })
            }
          >
            View
          </SecondaryButton>
        )}
        {!awaiting && (
          <Button
            intent="read"
            type="button"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? 'Downloading…' : COPY.download}
          </Button>
        )}
      </div>
    </div>
  );
}

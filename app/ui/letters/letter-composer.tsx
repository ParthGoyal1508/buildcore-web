'use client';

import { useState } from 'react';

import {
  decideApproval,
  type ApprovalDecisionAction,
} from '@/app/lib/api/approvals';
import type { IssuedLetter, LetterKind, Signatory } from '@/app/lib/api/letters';
import { LETTER_COPY } from '@/app/lib/constants';
import ActionReview from '@/app/ui/approvals/action-review';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import {
  FormError,
  SelectField,
  TextField,
  fieldClass,
} from '@/app/ui/settings/form-fields';

/** Fields that hold a paragraph rather than a phrase (036 J3) — by the variable's name. */
const PARAGRAPH_FIELD =
  /body|paragraph|address|responsibilit|reason|remark|detail|particulars|scope|terms|notes?$/i;

/** One variable the template expects, resolved from the server (FR-011). */
export interface LetterField {
  name: string;
  label: string;
  required: boolean;
}

interface LetterComposerProps {
  kind: LetterKind;
  /**
   * Data-driven, from the server. Not a per-kind form component: a kind defined
   * tomorrow (FR-011) has no component, and the whole point is that it needs none.
   */
  fields: LetterField[];
  signatories: Signatory[];
  /** The letter once composed — carries the approval state when the kind is gated. */
  letter: IssuedLetter | null;
  onCompose: (
    values: Record<string, string>,
    signatoryId?: string,
  ) => Promise<unknown>;
  onIssue: (values: Record<string, string>) => Promise<unknown>;
  /**
   * The letter as it would be issued from what is typed now — `POST /letters/preview` before it is
   * composed, `GET /letters/:id/preview` after (036 J2). Offered before composing too: the first
   * sight of a letter should not be the numbered one.
   */
  onPreview?: (
    values: Record<string, string>,
    signatoryId?: string,
  ) => Promise<Blob>;
  entityLabel: string;
  onDecided?: () => void;
}

/**
 * Composing and issuing a letter (017 web US3, FR-010a).
 *
 * ## The failure this component exists to avoid
 *
 * **Rendering an Issue button the server will refuse.** When the kind requires approval
 * and the chain is incomplete, Issue is *absent* — not disabled with a tooltip. A
 * disabled button says "you can't", and the four reasons the chain might be holding say
 * four different things, one of which (`already_decided`) is knowable only on the server.
 * `ActionReview` renders the real reason in its place.
 *
 * **`ActionReview` is imported, never reimplemented.** A second approval display diverges
 * the first time either changes, which is the failure 016 FR-001 exists to prevent — and
 * it is why this file has no opinion about who may decide.
 */
export function LetterComposer({
  kind,
  fields,
  signatories,
  letter,
  onCompose,
  onIssue,
  onPreview,
  entityLabel,
  onDecided,
}: LetterComposerProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatoryId, setSignatoryId] = useState(signatories[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  /**
   * Issue is offered only when the server has said the letter may take effect.
   *
   * For an ungated kind `compose` issues in the same call, so there is nothing here to
   * decide. For a gated one this reads the 016 state the server attached — never a
   * client-side guess about who holds what, because authority resolves through role-slot
   * mappings the browser cannot see.
   */
  const chainIsComplete =
    !kind.requiresApproval ||
    (letter !== null && letter.approval === null) ||
    letter?.approval?.state === 'approved';
  const awaitingApproval =
    kind.requiresApproval && letter !== null && !chainIsComplete;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      // The error's own message only when it carries a `code`. 016's quickstart Pass 3
      // caught this control's ancestor showing "Internal Server Error" to somebody who
      // had just typed a paragraph.
      const code = (err as { code?: string } | null)?.code;
      setError(code && err instanceof Error ? err.message : fallback);
      // Deliberately NOT cleared: a failed issue keeps every typed value, because
      // retyping a letter body because the API blinked is the worst thing this screen
      // could do to somebody.
    } finally {
      setBusy(false);
    }
  };

  // 036 J2 (2026-10-17): in the page's own viewer. This opened a new tab after the fetch had
  // finished, which Safari blocks as a pop-up — so on an iPad Preview did nothing at all.
  const { view, viewer } = useFileViewer();
  const preview = () => {
    if (!onPreview) return;
    void view({
      title: `${kind.label} — draft`,
      fileName: `${kind.label} (draft).pdf`,
      load: async () => {
        try {
          return await onPreview(
            values,
            kind.requiresSignature ? signatoryId : undefined,
          );
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          throw new Error(
            code && err instanceof Error ? err.message : LETTER_COPY.previewFailed,
          );
        }
      },
    });
  };

  /**
   * 036 J3 (2026-10-17): issuing gives the letter its permanent reference number, and an issued
   * letter cannot be edited — so it is asked once, not done on one click.
   */
  const confirmIssue = () =>
    confirmDialog({
      title: `Issue this ${kind.label.toLowerCase()}?`,
      message:
        'Issuing gives it a permanent reference number, and it cannot be edited afterwards — a correction means reissuing it as a new version. Preview it first if you have not.',
      confirmLabel: 'Issue',
      tone: 'default',
    });

  const missingRequired = fields
    .filter((f) => f.required && !(values[f.name] ?? '').trim())
    .map((f) => f.label);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const props = {
            id: `letter-field-${field.name}`,
            label: field.required ? `${field.label} (required)` : field.label,
            value: values[field.name] ?? '',
          };
          // A paragraph gets a box that shows it (036 J3): a body, an address, the terms.
          return PARAGRAPH_FIELD.test(field.name) ? (
            <div key={field.name} className="sm:col-span-2">
              <label
                htmlFor={props.id}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {props.label}
              </label>
              <textarea
                id={props.id}
                rows={4}
                value={props.value}
                onChange={(e) => setValue(field.name, e.target.value)}
                className={fieldClass}
              />
            </div>
          ) : (
            <TextField
              key={field.name}
              {...props}
              onChange={(e) => setValue(field.name, e.target.value)}
            />
          );
        })}
      </div>

      {kind.requiresSignature && (
        <SelectField
          id="letter-signatory"
          label="Signatory"
          hint={LETTER_COPY.signatoryRequired}
          value={signatoryId}
          onChange={(e) => setSignatoryId(e.target.value)}
        >
          {signatories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.title}
            </option>
          ))}
        </SelectField>
      )}

      <FormError message={error} />
      {viewer}

      {/* The gated case. `ActionReview` says who is being waited on; there is no Issue
          control beside it, because the server would refuse one. */}
      {awaitingApproval && letter?.approval && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm text-gray-700">
            {LETTER_COPY.awaitingApproval}
          </p>
          <ActionReview
            state={letter.approval}
            entityLabel={entityLabel}
            size="full"
            onDecide={async (
              action: ApprovalDecisionAction,
              reason?: string,
            ) => {
              await decideApproval(letter.approval!.instanceId, {
                action,
                reason,
              });
              onDecided?.();
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {onPreview && (
          <Button intent="read" type="button" onClick={preview} disabled={busy}>
            Preview
          </Button>
        )}

        {letter === null && (
          <Button
            type="button"
            loading={busy}
            disabled={missingRequired.length > 0}
            onClick={async () => {
              // An ungated kind is issued by compose itself.
              if (!kind.requiresApproval && !(await confirmIssue())) return;
              void run(
                () =>
                  onCompose(
                    values,
                    kind.requiresSignature ? signatoryId : undefined,
                  ),
                LETTER_COPY.issueFailed,
              );
            }}
          >
            {kind.requiresApproval ? 'Submit for approval' : 'Issue'}
          </Button>
        )}

        {/* Absent, not disabled, while the chain is incomplete. */}
        {letter !== null &&
          letter.status === 'composed' &&
          chainIsComplete && (
            <Button
              type="button"
              loading={busy}
              onClick={async () => {
                if (!(await confirmIssue())) return;
                void run(() => onIssue(values), LETTER_COPY.issueFailed);
              }}
            >
              Issue
            </Button>
          )}

        {missingRequired.length > 0 && letter === null && (
          <p className="text-xs text-gray-500">
            Still needed: {missingRequired.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

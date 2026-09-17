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
import {
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

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
  onPreview?: () => Promise<Blob>;
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

  const preview = async () => {
    if (!onPreview) return;
    await run(async () => {
      const blob = await onPreview();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, LETTER_COPY.previewFailed);
  };

  const missingRequired = fields
    .filter((f) => f.required && !(values[f.name] ?? '').trim())
    .map((f) => f.label);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <TextField
            key={field.name}
            id={`letter-field-${field.name}`}
            label={field.required ? `${field.label} (required)` : field.label}
            value={values[field.name] ?? ''}
            onChange={(e) => setValue(field.name, e.target.value)}
          />
        ))}
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
        {onPreview && letter && (
          <Button type="button" onClick={() => void preview()} disabled={busy}>
            Preview
          </Button>
        )}

        {letter === null && (
          <Button
            type="button"
            disabled={busy || missingRequired.length > 0}
            onClick={() =>
              void run(
                () =>
                  onCompose(
                    values,
                    kind.requiresSignature ? signatoryId : undefined,
                  ),
                LETTER_COPY.issueFailed,
              )
            }
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
              disabled={busy}
              onClick={() =>
                void run(() => onIssue(values), LETTER_COPY.issueFailed)
              }
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

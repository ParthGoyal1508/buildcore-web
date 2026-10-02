'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  LETTER_FIELD_SOURCES,
  declareLetterKindField,
  getLetterKindFields,
  withdrawLetterKindField,
  type LetterFieldSource,
} from '@/app/lib/api/letters';
import { LETTER_FIELD_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  CheckboxField,
  FormError,
  RowAction,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The fields one letter kind's templates may use (017 FR-011b, FR-011c) — `bugs.md` item 18.
 *
 * ## Why this screen exists
 *
 * FR-014 already required "define a new letter kind, **its variable fields** and its fixed terms",
 * and only the kind itself was built. The api keyed its token sets to the five shipped letter types,
 * so a kind defined here got an empty field list and the template editor then refused every field it
 * used. Both halves were individually satisfied and together they produced nothing usable — which is
 * why this is the editor and not a read-only list.
 *
 * ## Every field names where its value comes from
 *
 * That is the requirement, not a nicety. **A field that is only a label is a placeholder that renders
 * blank**, and a blank in a signed letter is indistinguishable from a deliberate omission. So the
 * source is required, the path is required for every source but `manual`, and the form says which is
 * which rather than letting the server refuse.
 *
 * ## Shipped kinds are shown, not edited
 *
 * Their fields are what every live template already references; letting one company rename a token
 * would break letters other companies have issued. Read-only is the honest rendering, and saying so
 * beats a control that always fails.
 */
export default function LetterKindFields({
  kindId,
  kindLabel,
  isShipped,
}: {
  kindId: string;
  kindLabel: string;
  isShipped: boolean;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [sourceType, setSourceType] = useState<LetterFieldSource>('manual');
  const [sourcePath, setSourcePath] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useQuery({
    queryKey: ['letterKindFields', kindId],
    queryFn: () => getLetterKindFields(kindId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['letterKindFields', kindId] });

  const declare = useMutation({
    mutationFn: () =>
      declareLetterKindField(kindId, {
        token: token.trim(),
        label: label.trim(),
        sourceType,
        // Sent as null for `manual` rather than omitted: the api refuses a path with `manual`, and
        // a stale value left in the input would otherwise be submitted after somebody switched the
        // source back.
        sourcePath: sourceType === 'manual' ? null : sourcePath.trim(),
        isRequired,
      }),
    onSuccess: () => {
      setToken('');
      setLabel('');
      setSourcePath('');
      setIsRequired(false);
      setError(null);
      void invalidate();
    },
    // The api's refusals name the field or the forbidden path; shown verbatim, because a generic
    // "could not save" throws away the only part that says what to do.
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : LETTER_FIELD_COPY.saveFailed,
      ),
  });

  const withdraw = useMutation({
    mutationFn: (fieldToken: string) =>
      withdrawLetterKindField(kindId, fieldToken),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : LETTER_FIELD_COPY.removeFailed,
      ),
  });

  const pathNeeded = sourceType !== 'manual';
  const ready =
    token.trim() !== '' &&
    label.trim() !== '' &&
    (!pathNeeded || sourcePath.trim() !== '');

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900">
          {LETTER_FIELD_COPY.heading(kindLabel)}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{LETTER_FIELD_COPY.hint}</p>
      </div>

      <FormError message={error} />

      {fields.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          {LETTER_FIELD_COPY.loading}
        </p>
      ) : fields.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {LETTER_FIELD_COPY.loadFailed}
        </p>
      ) : fields.data.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
          {/* Not a neutral "none yet": a kind with no fields has templates that cannot use a single
              variable, and somebody writing one needs to know that before they write it. */}
          {LETTER_FIELD_COPY.noneYet}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {fields.data.map((field) => (
            <li
              key={field.token}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900">
                  {field.label}
                  {field.isRequired && (
                    <span className="ml-1 text-xs text-amber-800">
                      {LETTER_FIELD_COPY.requiredMark}
                    </span>
                  )}
                </p>
                <p className="break-all text-xs text-gray-500">
                  <code>{`{{${field.token}}}`}</code>
                  {' · '}
                  {field.sourceType === 'manual'
                    ? LETTER_FIELD_COPY.manualSource
                    : `${field.sourceType}.${field.sourcePath}`}
                </p>
              </div>
              {isShipped ? (
                <span className="text-xs text-gray-400">
                  {LETTER_FIELD_COPY.notEditable}
                </span>
              ) : (
                <RowAction
                  type="button"
                  onClick={() => withdraw.mutate(field.token)}
                  disabled={withdraw.isPending}
                >
                  {LETTER_FIELD_COPY.remove}
                </RowAction>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Shipped kinds are listed and not edited — see the file docblock. */}
      {!isShipped && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-medium text-gray-900">
            {LETTER_FIELD_COPY.addHeading}
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="field-token"
              label={LETTER_FIELD_COPY.tokenLabel}
              hint={LETTER_FIELD_COPY.tokenHint}
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <TextField
              id="field-label"
              label={LETTER_FIELD_COPY.labelLabel}
              hint={LETTER_FIELD_COPY.labelHint}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <SelectField
              id="field-source"
              label={LETTER_FIELD_COPY.sourceLabel}
              hint={LETTER_FIELD_COPY.sourceHint}
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as LetterFieldSource)
              }
            >
              {LETTER_FIELD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {LETTER_FIELD_COPY.sourceLabels[source]}
                </option>
              ))}
            </SelectField>
            {/*
              Absent for `manual` rather than disabled. A disabled path field reads as "this is
              required and you cannot fill it"; the control simply not being there says what is
              actually true — a value typed at issue time reads no record.
            */}
            {pathNeeded && (
              <TextField
                id="field-path"
                label={LETTER_FIELD_COPY.pathLabel}
                hint={LETTER_FIELD_COPY.pathHint}
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
              />
            )}
          </div>
          <CheckboxField
            id="field-required"
            label={LETTER_FIELD_COPY.requiredLabel}
            checked={isRequired}
            onChange={(event) => setIsRequired(event.target.checked)}
          />
          <p className="text-xs text-gray-500">
            {LETTER_FIELD_COPY.requiredHint}
          </p>
          <div>
            <Button
              type="button"
              disabled={!ready || declare.isPending}
              onClick={() => {
                setError(null);
                declare.mutate();
              }}
            >
              {declare.isPending
                ? LETTER_FIELD_COPY.adding
                : LETTER_FIELD_COPY.add}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

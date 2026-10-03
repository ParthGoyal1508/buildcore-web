'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createLetterTemplate,
  getLetterKindFields,
  getLetterKinds,
  getLetterTemplates,
  templateTokens,
  updateLetterTemplate,
  type LetterKind,
  type LetterTemplate,
} from '@/app/lib/api/letters';
import { TEMPLATE_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';

/**
 * The letter template editor (017 US5, FR-014, T023, T024, T134, T135) — `bugs.md` item 18.
 *
 * ## What this replaced, and why the replacement is the feature
 *
 * The previous version of this screen was keyed to feature 011's five `letterType` values and fed
 * its variable picker from a **hardcoded map in this file**, mirroring an equally hardcoded map in
 * the api. 017 replaced that enum with `LetterKind` rows and FR-010 names fifteen kinds, so:
 *
 *   * ten of the fifteen kinds could not be chosen here at all;
 *   * a kind an administrator defined got an empty variable list and every token it used was flagged
 *     unknown, so FR-014 — "define a new letter kind, its variable fields and its fixed terms,
 *     **without a developer**" — was not reachable from this editor by any route;
 *   * and the list schema parsed `letterType` as that five-value enum with `.catch('offer')`, so a
 *     template for one of the other ten was **silently relabelled an offer letter** and saving it
 *     would have moved it onto the offer kind.
 *
 * The variables now come from `GET /letter-kinds/:id/fields` — the fields that kind actually
 * declares. That is the whole of the change, and it is what makes the client's "provide a template
 * creation tool for drafting new letter formats" true rather than written down.
 *
 * ## Structured fields and fixed text, not arbitrary markup
 *
 * Still a form, deliberately (spec Assumptions): a body of fixed text with `{{variables}}` inserted
 * from a list. The constraint is what keeps the feature tractable and what makes validation possible
 * at all — a rich-text editor would have to decide what a token means inside a table cell.
 *
 * ## Only that kind's fields are offered
 *
 * T134. A shared field list was offered to the client and declined, precisely so an offer letter's
 * editor cannot offer exit-settlement fields. Every list on this screen is scoped to the template's
 * own kind, and a `restricted` field never reaches it — the api refuses to declare a path naming
 * regulated personal data, and this screen filters again anyway (T024), because the cost there is
 * legal rather than cosmetic.
 */
export default function LetterTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LetterTemplate | null | 'new'>(null);

  const templates = useQuery({
    queryKey: ['letterTemplates'],
    queryFn: () => getLetterTemplates(),
  });
  const kinds = useQuery({
    queryKey: ['letterKinds'],
    queryFn: () => getLetterKinds(),
  });

  /** Kind label by key, so a row says "Work Order" rather than `letter_work_order`. */
  const labelFor = useMemo(() => {
    const byKey = new Map((kinds.data ?? []).map((kind) => [kind.key, kind]));
    // Falls back to the key rather than to a guess. A kind this client has not loaded is a kind it
    // cannot name, and printing the key is honest where printing "Offer Letter" was not.
    return (key: string) => byKey.get(key)?.label ?? key;
  }, [kinds.data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={TEMPLATE_COPY.title}
          description={TEMPLATE_COPY.description}
        />
        <Button onClick={() => setEditing('new')}>
          {TEMPLATE_COPY.newTemplate}
        </Button>
      </div>

      {templates.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          {TEMPLATE_COPY.loading}
        </p>
      ) : templates.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {TEMPLATE_COPY.loadFailed}
        </p>
      ) : templates.data.length === 0 ? (
        <p className="text-sm text-gray-500">{TEMPLATE_COPY.none}</p>
      ) : (
        <div className="space-y-2">
          {templates.data.map((template) => (
            <div
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-3 text-sm"
            >
              <span className="min-w-0 break-words">
                {labelFor(template.letterType)} — {template.name}{' '}
                {template.isActive && (
                  <StatusBadge
                    status="active"
                    label={TEMPLATE_COPY.activeBadge}
                  />
                )}
              </span>
              <RowAction type="button" onClick={() => setEditing(template)}>
                {TEMPLATE_COPY.edit}
              </RowAction>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          kinds={kinds.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: ['letterTemplates'],
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  kinds,
  onClose,
  onSaved,
}: {
  template: LetterTemplate | null;
  kinds: LetterKind[];
  onClose: () => void;
  onSaved: () => void;
}) {
  /**
   * Only active kinds can take a new template, and an inactive one keeps its own.
   *
   * A kind somebody retired should not appear in the "new template" list, but a template already
   * written against it must still be editable — otherwise retiring a kind silently strands its
   * templates with no way to correct them.
   */
  const selectable = template
    ? kinds.filter((kind) => kind.key === template.letterType)
    : kinds.filter((kind) => kind.isActive);

  const [letterType, setLetterType] = useState(
    template?.letterType ?? selectable[0]?.key ?? '',
  );
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.bodyTemplate ?? '');
  const [isActive, setIsActive] = useState(template?.isActive ?? false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const kind = kinds.find((candidate) => candidate.key === letterType) ?? null;
  const kindId = template?.letterKindId ?? kind?.id ?? '';

  const fields = useQuery({
    queryKey: ['letterKindFields', kindId],
    queryFn: () => getLetterKindFields(kindId),
    // Without a kind there is nothing to ask about, and asking with an empty id would 404 in a way
    // that reads as "this kind has no fields" rather than "no kind is chosen".
    enabled: kindId !== '',
  });

  /**
   * T024, belt and braces. The api refuses to *declare* a path naming regulated personal data, so a
   * restricted field should not exist to be offered — this filters a malformed or stale response
   * anyway, because the cost of offering an Aadhaar token in a letter template is legal.
   */
  const RESTRICTED = ['aadhaar', 'aadhar', 'pan', 'bankaccount', 'accountnumber', 'ifsc'];
  const offered = (fields.data ?? []).filter((field) => {
    const haystack = `${field.token} ${field.sourcePath ?? ''}`
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    return !RESTRICTED.some((fragment) => haystack.includes(fragment));
  });

  const declared = new Set(offered.map((field) => field.token));
  // T135. Computed here so the author sees it while typing rather than on save — and the server
  // refuses the same thing anyway, naming the same tokens, so the two cannot disagree about what
  // is valid.
  const undeclared = templateTokens(body).filter(
    (token) => !declared.has(token),
  );

  const insert = (token: string) => {
    const element = bodyRef.current;
    const text = `{{${token}}}`;
    if (!element) {
      setBody((current) => current + text);
      return;
    }
    const { selectionStart, selectionEnd } = element;
    setBody(
      (current) =>
        current.slice(0, selectionStart) + text + current.slice(selectionEnd),
    );
  };

  const mutation = useMutation({
    mutationFn: () =>
      template
        ? updateLetterTemplate(template.id, {
            name: name.trim(),
            bodyTemplate: body,
            isActive,
          })
        : createLetterTemplate({
            letterType,
            name: name.trim(),
            bodyTemplate: body,
            isActive,
          }),
    onSuccess: onSaved,
    // The api's refusal names the undeclared fields; shown verbatim, because a generic "could not
    // save" on a screen whose whole content is a template says nothing an author can act on.
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : TEMPLATE_COPY.saveFailed,
      ),
  });

  // Saving is disabled while the field list could not be loaded, rather than attempted. Without it
  // the editor cannot tell the author which variables are valid, and a save would be a guess the
  // server then refuses.
  const ready =
    letterType !== '' &&
    name.trim() !== '' &&
    body.trim() !== '' &&
    undeclared.length === 0 &&
    !fields.isError &&
    !fields.isPending;

  return (
    <Modal
      title={template ? TEMPLATE_COPY.editHeading : TEMPLATE_COPY.newHeading}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>
            {TEMPLATE_COPY.cancel}
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!ready || mutation.isPending}
          >
            {mutation.isPending ? TEMPLATE_COPY.saving : TEMPLATE_COPY.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id="template-kind"
            label={TEMPLATE_COPY.kindLabel}
            hint={template ? TEMPLATE_COPY.kindFixedHint : undefined}
            value={letterType}
            onChange={(event) => setLetterType(event.target.value)}
            disabled={!!template}
          >
            {selectable.map((candidate) => (
              <option key={candidate.id} value={candidate.key}>
                {candidate.label}
              </option>
            ))}
          </SelectField>
          <TextField
            id="template-name"
            label={TEMPLATE_COPY.nameLabel}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="template-body"
            >
              {TEMPLATE_COPY.bodyLabel}
            </label>
            <textarea
              id="template-body"
              ref={bodyRef}
              className="h-56 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              {TEMPLATE_COPY.bodyHint}
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-sm font-medium text-gray-700">
              {TEMPLATE_COPY.fieldsHeading}
            </p>
            {fields.isPending && kindId !== '' ? (
              <p className="text-xs text-gray-500" role="status">
                {TEMPLATE_COPY.fieldsLoading}
              </p>
            ) : fields.isError ? (
              <p className="text-xs text-red-700" role="alert">
                {TEMPLATE_COPY.fieldsFailed}
              </p>
            ) : offered.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1 text-xs text-amber-900">
                {/* Not a neutral empty list: the remedy is on another screen, so it is named. */}
                {TEMPLATE_COPY.fieldsNone}
              </p>
            ) : (
              <ul className="space-y-1">
                {offered.map((field) => (
                  <li key={field.token} className="min-w-0">
                    <button
                      type="button"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-left text-xs hover:bg-gray-50"
                      onClick={() => insert(field.token)}
                      title={`${TEMPLATE_COPY.insert} {{${field.token}}}`}
                    >
                      <span className="block truncate text-gray-900">
                        {field.label}
                        {field.isRequired && (
                          <span className="ml-1 text-amber-800">
                            {TEMPLATE_COPY.requiredMark}
                          </span>
                        )}
                      </span>
                      <code className="block break-all text-gray-500">
                        {`{{${field.token}}}`}
                      </code>
                      <span className="block truncate text-gray-400">
                        {field.sourceType === 'manual'
                          ? TEMPLATE_COPY.manualSource
                          : `${field.sourceType}.${field.sourcePath}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {undeclared.length > 0 && (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            role="alert"
          >
            <p className="font-medium">
              {TEMPLATE_COPY.undeclaredHeading(undeclared.length)}
            </p>
            {/* Named, every one of them — T135. "Invalid template" on a screen that is entirely one
                template tells the author nothing. */}
            <p className="mt-1">
              {TEMPLATE_COPY.undeclaredBody(undeclared)}
            </p>
          </div>
        )}

        <CheckboxField
          id="template-active"
          label={TEMPLATE_COPY.activeLabel}
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </div>
    </Modal>
  );
}

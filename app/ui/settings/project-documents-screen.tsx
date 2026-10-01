'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  defineProjectDocumentKind,
  getDocumentRequirements,
  putDocumentRequirements,
} from '@/app/lib/api/project-documents';
import { createCompanyDocumentKind } from '@/app/lib/api/company-documents';
import { getCurrentUser } from '@/app/lib/api/users';
import { DOCUMENT_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  DocumentKindForm,
  type DocumentKindInput,
} from '@/app/ui/documents/document-kind-form';
import { useCompanyContext } from '@/app/ui/settings/company-context';
import {
  FormError,
  RowAction,
  inlineSelectClass,
} from '@/app/ui/settings/form-fields';

/** One row as the editor holds it, before it is written back as a set. */
interface Draft {
  documentTypeId: string;
  code: string;
  name: string;
  isMandatory: boolean;
}

/**
 * Which documents every project must hold, and configuring them (017 US2, FR-007, FR-022).
 *
 * This was read-only, and its own comment said why: an editor needs a list of the kinds
 * that *may* be required, and without one the only way to name a requirement is to know a
 * document type's internal identifier. `availableTypes` is that list (backend FR-007a),
 * so the editor is now buildable and the screen is one.
 *
 * The whole set is written with the single `PUT` the backend offers, which replaces
 * rather than merges. Per-row autosave would mean one complete rewrite per toggle, and an
 * interrupted third of three would leave a set nobody chose — so the edits are local and
 * there is one Save.
 */
export function ProjectDocumentsScreen() {
  const queryClient = useQueryClient();
  const { companyId, canSwitch } = useCompanyContext();
  /**
   * The draft carries the company it belongs to.
   *
   * Not an effect resetting it on a company change: an effect that calls `setState` runs
   * a render with the previous company's edits still on screen before correcting itself,
   * and React's own lint rule says so. Comparing here means a stale draft is never a
   * state the screen can be in, rather than one it passes through.
   */
  const [draft, setDraft] = useState<{
    companyId: string | null;
    rows: Draft[];
  } | null>(null);
  const [toAdd, setToAdd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /**
   * Held until the company is settled, for a caller who can switch (FR-021).
   *
   * `CompanyProvider` resolves to `null` on first render and to a real id once the
   * company list arrives. Firing in between asks the server for "my own company", which
   * is either a different company's data shown for an instant under the selected
   * company's name, or — for a cross-company account with no home company of its own —
   * a refusal the screen would render as a load failure before recovering. A caller who
   * cannot switch never waits: their `null` means "use my own", which is correct.
   */
  const scopeReady = !canSwitch || companyId !== null;

  /**
   * The company is part of the key, not just the request (FR-021). Without it react-query
   * answers a switch from its cache and shows the previous company's rows under the new
   * company's name — the failure that looks exactly like success.
   */
  const queryKey = ['project-document-requirements', companyId ?? 'own'];

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => getDocumentRequirements(companyId ?? undefined),
    enabled: scopeReady,
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: (rows: Draft[]) =>
      putDocumentRequirements(
        rows.map((r) => ({
          documentTypeId: r.documentTypeId,
          isMandatory: r.isMandatory,
        })),
        companyId ?? undefined,
      ),
    onSuccess: async () => {
      setError(null);
      setDraft(null);
      setSaved(true);
      await invalidate();
    },
    onError: () => setError(DOCUMENT_COPY.requirementsSaveFailed),
  });

  /** A kind FR-007 names that this company has no type for (FR-007a). */
  const defineDeclared = useMutation({
    mutationFn: (code: string) =>
      defineProjectDocumentKind(code, companyId ?? undefined),
    onSuccess: async () => {
      setError(null);
      setDraft(null);
      await invalidate();
    },
    onError: () => setError(DOCUMENT_COPY.requirementsDefineFailed),
  });

  /**
   * A kind of this company's own invention.
   *
   * Goes through the company-documents route, because that is the one that creates a
   * company-scoped kind from a free-form name; this screen requires kinds, it does not
   * own the vocabulary. The new kind lands in `availableTypes` on the refetch and can be
   * required from the picker immediately.
   */
  const addKind = useMutation({
    mutationFn: (input: DocumentKindInput) =>
      createCompanyDocumentKind(input, companyId ?? undefined),
    onSuccess: async () => {
      setError(null);
      setDraft(null);
      await invalidate();
    },
    onError: () => setError(DOCUMENT_COPY.addKindFailed),
  });

  /**
   * FR-022b, T067/T068: **hidden, not disabled.**
   *
   * Read and write are different authorities here. Anyone with `PROJECTS` may see what every
   * project owes; changing what every project owes is a `SETTINGS` decision, and the backend
   * draws exactly that line — `GET` requires `PROJECTS`, `PUT` requires `SETTINGS`. Until
   * 2026-10-01 this screen offered every control to everybody and let the server refuse the save,
   * which teaches the reader that the screen is broken rather than that they lack the authority.
   *
   * **`SETTINGS`, not `COMPANY_SETTINGS`.** The api spec's FR-007c was corrected to `SETTINGS` on
   * 2026-09-16; using the other one here would refuse the people who are supposed to hold this.
   */
  const mayConfigure = !!user?.permissions.includes('SETTINGS');

  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !data) {
    return <FormError message="The requirements could not be loaded." />;
  }

  // The server's answer until somebody edits, then the edit. `usingDefaults` needs no
  // second code path: the rows are the same rows, and saving them is what adopts them.
  const mine = draft?.companyId === companyId ? draft : null;
  const rows: Draft[] = mine?.rows ?? data.requirements;
  const dirty = mine !== null;

  const addable = data.availableTypes.filter(
    // What is already on the list is not offered. The backend deduplicates a set sent
    // with one kind twice, but an option that silently does nothing is a different
    // problem and belongs fixed where the offer is made.
    (t) => !rows.some((r) => r.documentTypeId === t.documentTypeId),
  );

  const edit = (next: Draft[]) => {
    setDraft({ companyId, rows: next });
    setSaved(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-gray-600">
          {data.usingDefaults
            ? DOCUMENT_COPY.requirementsDefaults
            : DOCUMENT_COPY.requirementsConfigured}
        </p>
        <FormError message={error} />
        {saved && !dirty && (
          <p className="mt-1 text-sm text-green-700">
            {DOCUMENT_COPY.requirementsSaved}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-4 text-sm text-amber-900">
          {DOCUMENT_COPY.requirementsEmpty}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {rows.map((requirement) => (
            <li
              key={requirement.documentTypeId}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <span className="truncate text-sm text-gray-900">
                {requirement.name}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                {/* A reader without `SETTINGS` sees the strength as a sentence, not a control:
                    the fact is theirs to know, the decision is not theirs to take. */}
                {!mayConfigure && (
                  <span className="text-xs text-gray-600">
                    {requirement.isMandatory
                      ? DOCUMENT_COPY.strengthMandatory
                      : DOCUMENT_COPY.strengthAdvisory}
                  </span>
                )}
                {mayConfigure && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="sr-only">
                    {DOCUMENT_COPY.strengthLegend} — {requirement.name}
                  </span>
                  <select
                    className={inlineSelectClass}
                    value={requirement.isMandatory ? 'mandatory' : 'advisory'}
                    onChange={(event) =>
                      edit(
                        rows.map((r) =>
                          r.documentTypeId === requirement.documentTypeId
                            ? {
                                ...r,
                                isMandatory: event.target.value === 'mandatory',
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    {/*
                      Named by consequence, not by "Required"/"Optional" (FR-022a, T066). Those
                      were the labels until 2026-10-01; "optional" says what a kind is not, and
                      since the 2026-09-16 amendment the two differ in *effect* — one refuses the
                      creation of a project outright. A reader choosing between "Required" and
                      "Optional" cannot see that, and the person who most needs to is the one
                      deciding whether to make a kind mandatory.
                    */}
                    <option value="mandatory">
                      {DOCUMENT_COPY.strengthMandatory}
                    </option>
                    <option value="advisory">
                      {DOCUMENT_COPY.strengthAdvisory}
                    </option>
                  </select>
                </label>
                )}
                {mayConfigure && (
                  <RowAction
                    type="button"
                    onClick={() =>
                      edit(
                        rows.filter(
                          (r) =>
                            r.documentTypeId !== requirement.documentTypeId,
                        ),
                      )
                    }
                  >
                    Remove
                  </RowAction>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {mayConfigure && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(rows)}
          >
            {DOCUMENT_COPY.requirementsSave}
          </Button>
          {dirty && (
            <RowAction type="button" onClick={() => setDraft(null)}>
              {DOCUMENT_COPY.requirementsDiscard}
            </RowAction>
          )}
        </div>
      )}

      {mayConfigure && (
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-900">
          {DOCUMENT_COPY.requirementsAddHeading}
        </h3>
        {addable.length === 0 ? (
          <p className="text-xs text-gray-500">
            {DOCUMENT_COPY.requirementsNoneToAdd}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="requirement-to-add">
              {DOCUMENT_COPY.requirementsAddPlaceholder}
            </label>
            <select
              id="requirement-to-add"
              className={inlineSelectClass}
              value={toAdd}
              onChange={(event) => setToAdd(event.target.value)}
            >
              <option value="">
                {DOCUMENT_COPY.requirementsAddPlaceholder}
              </option>
              {addable.map((type) => (
                <option key={type.documentTypeId} value={type.documentTypeId}>
                  {type.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={!toAdd}
              onClick={() => {
                const type = addable.find((t) => t.documentTypeId === toAdd);
                if (!type) return;
                edit([
                  ...rows,
                  {
                    documentTypeId: type.documentTypeId,
                    code: type.code,
                    name: type.name,
                    isMandatory: true,
                  },
                ]);
                setToAdd('');
              }}
            >
              {DOCUMENT_COPY.requirementsAddButton}
            </Button>
          </div>
        )}
      </section>
      )}

      {data.undefinedCodes.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <h3 className="text-sm font-medium text-amber-900">
            {DOCUMENT_COPY.requirementsUndefinedHeading}
          </h3>
          {/* Named rather than silently dropped. Without this, a missing type quietly
              shrinks the required set from six to five and nobody sees the sixth kind
              disappear — every project then reports itself complete without it. The
              action is new: reporting a problem with nothing to do about it is what this
              panel used to be. */}
          <p className="mt-1 text-xs text-amber-800">
            {DOCUMENT_COPY.requirementsUndefinedHint}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {data.undefinedCodes.map((code) => (
              <li
                key={code}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-sm text-amber-900">{code}</span>
                {mayConfigure && (
                  <RowAction
                    type="button"
                    disabled={defineDeclared.isPending}
                    onClick={() => defineDeclared.mutate(code)}
                  >
                    {DOCUMENT_COPY.requirementsDefineIt}
                  </RowAction>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* T064's in-place definition — a write, so it is absent for a reader who may not
          configure. A gate that requires configuring a kind elsewhere before it can be required
          here is a gate people route around, which is why it lives on this screen at all. */}
      {mayConfigure && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h3 className="mb-1 text-sm font-medium text-gray-900">
            {DOCUMENT_COPY.addKindHeading}
          </h3>
          <DocumentKindForm
            idPrefix="project"
            hint={DOCUMENT_COPY.requirementsKindHint}
            busy={addKind.isPending}
            onCreate={(input) => addKind.mutateAsync(input)}
          />
        </section>
      )}
    </div>
  );
}

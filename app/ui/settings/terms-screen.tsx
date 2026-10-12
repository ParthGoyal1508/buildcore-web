"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  getTerms,
  putTerms,
  type TermsDocumentKind,
  type TermsTemplate,
} from "@/app/lib/api/terms";
import { ApiError } from "@/app/lib/api/client";
import { TERMS_COPY } from "@/app/lib/constants";
import { Button } from "@/app/ui/button";
import { FormError, SecondaryButton } from "@/app/ui/settings/form-fields";

/**
 * The company's standard terms, one tab per kind of document (2026-10-11).
 *
 * ## What editing here does, and what it deliberately does not
 *
 * It changes what the **next** document starts from. A work order keeps the terms it
 * was raised under in its own column, exactly as a bill keeps the rate it was priced
 * at, so rewording the standard set never rewords an award somebody has already signed.
 * That is said on the screen rather than left to be discovered, because the opposite
 * assumption is the dangerous one.
 *
 * ## No reset button
 *
 * The shipped set is still in the code and the screen shows it until somebody saves
 * over it. A button that discarded a company's own drafting in one click is the more
 * expensive mistake, and there is nothing to recover it from.
 */
export function TermsScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<TermsDocumentKind>("work_order");
  /** Only what has been typed. Null means untouched, so the saved text shows through. */
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terms = useQuery({
    queryKey: ["settings", "terms"],
    queryFn: getTerms,
  });

  const current: TermsTemplate | undefined = terms.data?.find(
    (row) => row.documentKind === selected,
  );
  const body = draft ?? current?.body ?? "";

  const save = useMutation({
    mutationFn: () => putTerms(selected, body),
    onSuccess: () => {
      setDraft(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["settings", "terms"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : TERMS_COPY.saveFailed),
  });

  if (terms.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {TERMS_COPY.loading}
      </p>
    );
  }
  if (terms.isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {TERMS_COPY.loadFailed}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-gray-600">{TERMS_COPY.intro}</p>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={TERMS_COPY.kindsLabel}
      >
        {(terms.data ?? []).map((row) => (
          <button
            key={row.documentKind}
            type="button"
            role="tab"
            aria-selected={row.documentKind === selected}
            onClick={() => {
              // The draft belongs to the kind it was typed against; carrying it to
              // another tab would save one document's clauses onto another.
              setDraft(null);
              setError(null);
              setSelected(row.documentKind);
            }}
            className={
              row.documentKind === selected
                ? "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            }
          >
            {TERMS_COPY.kindLabels[row.documentKind]}
            {/* The space is load-bearing. `ml-2` separates the two for a sighted
                reader, but the tab's *text* is what `getByRole('tab', { name })`
                matches and what a screen reader announces — and without this the
                accessible name was "Letter of intentstandard". */}
            {!row.isCustomised && (
              <>
                {' '}
                <span className="ml-1 text-xs opacity-75">
                  {TERMS_COPY.shippedBadge}
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {current && !current.isCustomised && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          {TERMS_COPY.stillShipped}
        </p>
      )}

      <label className="text-sm font-medium text-gray-700" htmlFor="terms-body">
        {TERMS_COPY.bodyLabel}
      </label>
      <textarea
        id="terms-body"
        rows={18}
        value={body}
        onChange={(event) => setDraft(event.target.value)}
        className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
      />
      <p className="text-xs text-gray-500">{TERMS_COPY.bodyHint}</p>

      {error && <FormError message={error} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {draft !== null && (
          <SecondaryButton type="button" onClick={() => setDraft(null)}>
            {TERMS_COPY.discard}
          </SecondaryButton>
        )}
        <Button
          type="button"
          disabled={save.isPending || draft === null || body.trim() === ""}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
        >
          {save.isPending ? TERMS_COPY.saving : TERMS_COPY.save}
        </Button>
      </div>
    </section>
  );
}

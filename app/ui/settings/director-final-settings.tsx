'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import {
  getDirectorFinalSet,
  proposeDirectorFinalChange,
  type DirectorFinalEntry,
} from '@/app/lib/api/approvals';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  DIRECTOR_FINAL_MESSAGES,
  MESSAGES,
  approvalActionTypeLabel,
} from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { FormError } from '@/app/ui/settings/form-fields';

/**
 * The action type whose gate cannot be moved.
 *
 * Mirrors the backend's `ACTION_DIRECTOR_FINAL_SET_CHANGE`. Duplicated as a literal rather than
 * imported because there is nothing to import it from — but the duplication is safe in the
 * direction that matters: if this string ever stopped matching, the control would appear and the
 * backend would refuse the submission with `DIRECTOR_FINAL_SELF_CHANGE_REFUSED`. The server is the
 * enforcement; this is the explanation.
 */
const SELF_CHANGE = 'director_final_set_change';

/** Distinct per state, and deliberately not a traffic light. */
const STATE_CLASS: Record<string, string> = {
  final: 'bg-green-100 text-green-900',
  not_final_by_decision: 'bg-gray-100 text-gray-700',
  // Amber, not grey. A gap nobody has decided is the thing this screen exists to surface, so it
  // must not recede into the same visual weight as a decision somebody took.
  not_configured: 'bg-amber-100 text-amber-900',
};

/**
 * Which actions require the Director's final approval (016 FR-017 to FR-020).
 *
 * ## Why this screen is the answer to "every critical action"
 *
 * The client asked for every critical action to require the Director. A literal every-action gate
 * would put the Director in the path of a stationery indent, so the product's answer is a named,
 * configurable set. That answer is only honest if the client can see the set — and only *useful*
 * if they can tell the difference between an action somebody decided needs no Director and one
 * nobody has considered at all. Those two are the same in a two-state model, and the second is
 * exactly what the client's question is about, which is why the API reports three states and this
 * screen renders three (FR-017, web T062).
 *
 * ## Nothing here saves
 *
 * Editing the set is itself director-final (FR-018). Whoever could edit it directly could remove
 * payment release from it and then release a payment, so a change is submitted into the same chain
 * as everything else. The control says so before it is pressed, and the list goes on showing what
 * governs *today* while a change is outstanding — two readable things, not one ambiguous one.
 */
export default function DirectorFinalSettings() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Action type → the mark the user has moved it to. Only what differs is submitted. */
  const [edits, setEdits] = useState<Record<string, boolean>>({});

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['directorFinalSet'],
    queryFn: getDirectorFinalSet,
  });

  /**
   * FR-020, T066/T067: **hidden, not disabled.**
   *
   * A disabled control tells somebody the capability exists and they are not trusted with it,
   * which is the wrong message on a settings screen — and web 019's FR-004 makes hiding the
   * general rule. Read from the caller's own permissions; once web 019 ships this becomes a
   * level-aware check (`COMPANY_SETTINGS` at write) and the module-level value here is correct
   * until then.
   */
  const mayChange = !!user?.permissions.includes('COMPANY_SETTINGS');

  const pending = data?.pending ?? null;

  const propose = useMutation({
    mutationFn: proposeDirectorFinalChange,
    onMutate: () => {
      setError(null);
      setSubmitted(false);
    },
    onSuccess: () => {
      // Refetched because a pending change is now part of what this screen must show — to this
      // reader and to every other one (FR-019).
      void queryClient.invalidateQueries({ queryKey: ['directorFinalSet'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalCount'] });
      void queryClient.invalidateQueries({ queryKey: ['approvalQueue'] });
      setEdits({});
      setSubmitted(true);
    },
    // Shown verbatim: the backend's refusals here name what to do about them, and a generic
    // "could not save" would throw that away.
    onError: (err: Error) => setError(err.message),
  });

  const entries = data?.entries ?? [];
  const changed = entries.filter(
    (entry) => entry.actionType in edits && edits[entry.actionType] !== entry.isFinal,
  );

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-gray-900">
          {DIRECTOR_FINAL_MESSAGES.heading}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {DIRECTOR_FINAL_MESSAGES.intro}
        </p>
        {!mayChange && (
          <p className="mt-1 text-sm text-gray-500">
            {DIRECTOR_FINAL_MESSAGES.readOnly}
          </p>
        )}
      </div>

      {/*
        FR-019. Shown to *every* reader, not only the person who submitted it, so two people do
        not submit the same edit — and rendered above the list, because it changes how the list
        below should be read.
      */}
      {pending && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">
            {DIRECTOR_FINAL_MESSAGES.pendingHeading}
          </p>
          <p className="mt-1">
            {DIRECTOR_FINAL_MESSAGES.pendingBy(
              pending.proposedByName ?? pending.proposedBy,
              dateTimeLabel(pending.createdAt),
            )}
          </p>
          <ul className="mt-2 space-y-0.5">
            {Object.entries(pending.after ?? {}).map(([actionType, to]) => (
              <li key={actionType} className="break-words">
                {DIRECTOR_FINAL_MESSAGES.pendingChange(
                  approvalActionTypeLabel(actionType),
                  DIRECTOR_FINAL_MESSAGES.stateLabels[
                    pending.before?.[actionType] ? 'final' : 'not_final_by_decision'
                  ],
                  DIRECTOR_FINAL_MESSAGES.stateLabels[
                    to ? 'final' : 'not_final_by_decision'
                  ],
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2">{DIRECTOR_FINAL_MESSAGES.pendingLocked}</p>
        </div>
      )}

      {submitted && (
        <p
          role="status"
          className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900"
        >
          {DIRECTOR_FINAL_MESSAGES.submitted}
        </p>
      )}

      <FormError message={error} />

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {entries.map((entry) => (
          <DirectorFinalRow
            key={entry.actionType}
            entry={entry}
            /** Undefined until the reader moves it, so "unchanged" and "set back" differ. */
            edited={edits[entry.actionType]}
            mayChange={mayChange && !pending}
            onChange={(isFinal) =>
              setEdits((current) => ({ ...current, [entry.actionType]: isFinal }))
            }
          />
        ))}
      </ul>

      {mayChange && !pending && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={changed.length === 0 || propose.isPending}
            onClick={() =>
              propose.mutate(
                changed.map((entry) => ({
                  actionType: entry.actionType,
                  isFinal: edits[entry.actionType],
                })),
              )
            }
          >
            {propose.isPending
              ? DIRECTOR_FINAL_MESSAGES.submitting
              : DIRECTOR_FINAL_MESSAGES.submit}
          </Button>
          {changed.length === 0 && (
            <span className="text-sm text-gray-500">
              {DIRECTOR_FINAL_MESSAGES.noChanges}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * One action type: what governs today, and what the reader has moved it to.
 *
 * The mark in force stays on screen while an edit is pending locally, which is the same promise
 * FR-018's "keep the mark currently in force displayed" makes about a submitted change. A control
 * that replaced the current state with the proposed one would leave nothing saying what is true
 * now.
 */
function DirectorFinalRow({
  entry,
  edited,
  mayChange,
  onChange,
}: {
  entry: DirectorFinalEntry;
  edited: boolean | undefined;
  mayChange: boolean;
  onChange: (isFinal: boolean) => void;
}) {
  const isSelfChange = entry.actionType === SELF_CHANGE;
  const moved = edited !== undefined && edited !== entry.isFinal;

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">
          {approvalActionTypeLabel(entry.actionType)}
        </p>
        <p className="mt-0.5 text-sm text-gray-600">
          {DIRECTOR_FINAL_MESSAGES.stateHints[entry.state]}
        </p>
        {entry.updatedAt ? (
          <p className="mt-0.5 text-xs text-gray-500">
            {DIRECTOR_FINAL_MESSAGES.decidedBy(
              entry.updatedByName ?? entry.updatedBy ?? '—',
              dateTimeLabel(entry.updatedAt),
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-500">
            {DIRECTOR_FINAL_MESSAGES.decidedByNobody}
          </p>
        )}
        {isSelfChange && (
          <p className="mt-1 text-xs text-gray-600">
            {DIRECTOR_FINAL_MESSAGES.selfChangeLocked}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span
          className={clsx(
            'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
            STATE_CLASS[entry.state],
          )}
        >
          {DIRECTOR_FINAL_MESSAGES.inForce}:{' '}
          {DIRECTOR_FINAL_MESSAGES.stateLabels[entry.state]}
        </span>
        {moved && (
          <span className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">
            {DIRECTOR_FINAL_MESSAGES.proposed}:{' '}
            {
              DIRECTOR_FINAL_MESSAGES.stateLabels[
                edited ? 'final' : 'not_final_by_decision'
              ]
            }
          </span>
        )}
        {/* Hidden rather than disabled for a reader who may not change the set, and absent
            entirely on the one entry whose gate cannot move. */}
        {mayChange && !isSelfChange && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={edited ?? entry.isFinal}
              onChange={(event) => onChange(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {DIRECTOR_FINAL_MESSAGES.stateLabels.final}
          </label>
        )}
      </div>
    </li>
  );
}

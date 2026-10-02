'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  deleteLetterKind,
  getLetterKinds,
  upsertLetterKind,
} from '@/app/lib/api/letters';
import { LETTER_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import LetterKindFields from '@/app/ui/settings/letter-kind-fields';
import {
  CheckboxField,
  FormError,
  RowAction,
  TextField,
} from '@/app/ui/settings/form-fields';

const QUERY_KEY = ['letter-kinds'];

/**
 * Letter kinds as data (017 US5, FR-011).
 *
 * The point of this screen is that it exists. Before 017 a new letter kind was a Prisma
 * enum value: a schema change, a migration and a release. Here it is a row somebody
 * types.
 */
export function LetterKindsScreen() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which kind's fields are open. One at a time: two expanded lists on a phone is a scroll. */
  const [expanded, setExpanded] = useState<string | null>(null);

  /**
   * No company segment any more (019 FR-005).
   *
   * The hazard this guarded against is real — react-query answering a switch from cache
   * shows the previous company's rows under the new company's name, the failure that looks
   * exactly like success. It is now handled once, centrally: the switcher clears the whole
   * cache, so no screen has to remember to key on a company it no longer knows.
   */
  const queryKey = [...QUERY_KEY];

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => getLetterKinds(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: () =>
      upsertLetterKind({ key, label, requiresSignature }, undefined),
    onSuccess: () => {
      setKey('');
      setLabel('');
      setRequiresSignature(false);
      setError(null);
      void invalidate();
    },
    onError: (err: unknown) => {
      // `LETTER_KIND_KEY_RESERVED` names the key that clashed. Shown verbatim, because
      // "could not create" would throw away the only part that says what to do.
      const code = (err as { code?: string } | null)?.code;
      setError(
        code && err instanceof Error
          ? err.message
          : 'The letter kind could not be created.',
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLetterKind(id),
    onSuccess: () => {
      setError(null);
      void invalidate();
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code && err instanceof Error
          ? err.message
          : LETTER_COPY.kindInUseFallback,
      );
    },
  });

  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !data) {
    return <FormError message="Letter kinds could not be loaded." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={error} />

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {data.map((kind) => (
          <li
            key={kind.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-gray-900">{kind.label}</p>
              <p className="text-xs text-gray-500">
                <code>{kind.key}</code>
                {kind.isShipped ? ' · provided by BuildCore' : ' · yours'}
                {kind.requiresApproval ? ' · needs approval' : ''}
                {kind.requiresSignature ? ' · signed' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RowAction
                type="button"
                intent="read"
                aria-expanded={expanded === kind.id}
                onClick={() =>
                  setExpanded((current) =>
                    current === kind.id ? null : kind.id,
                  )
                }
              >
                {expanded === kind.id ? 'Hide fields' : 'Fields'}
              </RowAction>
              {/* A shipped kind belongs to every company, so this company may not edit or
                  delete it. Saying so beats a button that always fails. */}
              {kind.isShipped ? (
                <span className="text-xs text-gray-400">Not editable</span>
              ) : (
                <RowAction
                  type="button"
                  onClick={() => remove.mutate(kind.id)}
                  disabled={remove.isPending}
                >
                  Delete
                </RowAction>
              )}
            </div>
            {/*
              017 FR-011b. Expanded in place rather than on a screen of its own: a kind's fields are
              only meaningful beside the kind, and a separate route would make the common act —
              define a kind, then say what goes in it — two navigations instead of one.

              `intent="read"` on the toggle above because expanding writes nothing; without it the
              control would vanish for a reader, who can legitimately look at what a kind declares.
            */}
            {expanded === kind.id && (
              <div className="w-full">
                <LetterKindFields
                  kindId={kind.id}
                  kindLabel={kind.label}
                  isShipped={kind.isShipped}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-900">
          Add a letter kind
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="kind-key"
            label="Key"
            hint="Lowercase with underscores. Permanent — issued letters match on it."
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <TextField
            id="kind-label"
            label="Label"
            hint="What people see. Editable later."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <CheckboxField
            id="kind-signature"
            label="Carries a signature"
            checked={requiresSignature}
            onChange={(e) => setRequiresSignature(e.target.checked)}
          />
        </div>
        <Button
          type="button"
          className="mt-4"
          disabled={!key.trim() || !label.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Adding…' : 'Add kind'}
        </Button>
      </section>
    </div>
  );
}

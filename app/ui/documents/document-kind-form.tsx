'use client';

import { useState } from 'react';

import { DOCUMENT_COPY } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { CheckboxField, TextField } from '@/app/ui/settings/form-fields';

export interface DocumentKindInput {
  name: string;
  hasExpiry: boolean;
  needsNumber: boolean;
}

interface DocumentKindFormProps {
  onCreate: (input: DocumentKindInput) => Promise<unknown>;
  /** Disambiguates the field ids when two of these ever share a page. */
  idPrefix: string;
  /** Overrides the hint where the surrounding screen needs to say something else. */
  hint?: string;
  busy?: boolean;
}

/**
 * Defining a document kind, shared by the company and project documents screens.
 *
 * Extracted rather than copied. Both screens create rows in one table through routes
 * that differ only in which permission guards them, and two copies of the form is how
 * the two drift into disagreeing about what a kind is — the company one was a week old
 * when the second screen needed it, which is exactly when extracting is cheap.
 *
 * Deliberately three fields. There is no code input: the server derives it, because a
 * code is an internal identifier and an administrator holding a certificate has no basis
 * on which to invent one. There is no restricted checkbox either: restriction is a rule
 * about regulated personal data settled in configuration, not a per-kind preference.
 */
export function DocumentKindForm({
  onCreate,
  idPrefix,
  hint,
  busy = false,
}: DocumentKindFormProps) {
  const [name, setName] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [needsNumber, setNeedsNumber] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onCreate({ name, hasExpiry, needsNumber });
    setName('');
    setHasExpiry(false);
    setNeedsNumber(false);
  };

  return (
    <>
      <p className="mb-3 text-xs text-gray-500">
        {hint ?? DOCUMENT_COPY.addKindHint}
      </p>
      <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
        <TextField
          id={`${idPrefix}-kind-name`}
          label={DOCUMENT_COPY.addKindNameLabel}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
        <CheckboxField
          id={`${idPrefix}-kind-expires`}
          label={DOCUMENT_COPY.addKindExpires}
          checked={hasExpiry}
          onChange={(event) => setHasExpiry(event.target.checked)}
        />
        <CheckboxField
          id={`${idPrefix}-kind-number`}
          label={DOCUMENT_COPY.addKindNeedsNumber}
          checked={needsNumber}
          onChange={(event) => setNeedsNumber(event.target.checked)}
        />
        <div>
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            {DOCUMENT_COPY.addKindSubmit}
          </Button>
        </div>
      </form>
    </>
  );
}

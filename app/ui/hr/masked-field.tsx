'use client';

import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

import { revealPii } from '@/app/lib/api/hr-payroll';
import {
  HR_MESSAGES,
  PII_FIELD_LABELS,
  PII_REVEAL_TIMEOUT_MS,
  type PiiField,
} from '@/app/lib/constants';

/**
 * A regulated identifier, masked by default (spec FR-003).
 *
 * Three things make this more than a toggle:
 *
 * 1. The masked value is all the client ever holds. `buildcore-api`'s
 *    `PiiMaskingInterceptor` strips the encrypted columns from every read path, so
 *    there is no full value sitting in a prop waiting to be inspected — revealing
 *    means asking the server, one field per call.
 * 2. Every reveal is written to the backend's audit log before the value comes
 *    back. The hint below the control says so, because a clerk should know that
 *    looking is recorded.
 * 3. The value re-masks itself after a short delay. A revealed Aadhaar left on
 *    screen outlives the reason it was revealed for, and nobody remembers to hide
 *    it again.
 */
export default function MaskedField({
  employeeId,
  field,
  maskedValue,
  label,
}: {
  employeeId: string;
  field: PiiField;
  /** The last-4 form the list/detail endpoints return. */
  maskedValue: string | null;
  label?: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fieldLabel = label ?? PII_FIELD_LABELS[field];

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRevealed(null);
  }

  async function reveal() {
    setIsRevealing(true);
    setError(null);
    try {
      const result = await revealPii(employeeId, field);
      setRevealed(result.value ?? '—');
      timer.current = setTimeout(hide, PII_REVEAL_TIMEOUT_MS);
    } catch {
      setError('Could not reveal this value.');
    } finally {
      setIsRevealing(false);
    }
  }

  if (!maskedValue) {
    return <span className="text-sm text-gray-400">Not recorded</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm tabular-nums">
        {revealed ?? maskedValue}
      </span>
      <button
        type="button"
        onClick={revealed ? hide : reveal}
        disabled={isRevealing}
        // The accessible name carries the field, so a screen-reader user tabbing
        // through a row of four of these can tell which one they are on.
        aria-label={
          revealed ? `Hide ${fieldLabel}` : `Reveal full ${fieldLabel}`
        }
        title={revealed ? undefined : HR_MESSAGES.revealPiiHint(fieldLabel)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
      >
        {revealed ? (
          <EyeSlashIcon className="w-4" aria-hidden="true" />
        ) : (
          <EyeIcon className="w-4" aria-hidden="true" />
        )}
        {isRevealing ? 'Revealing…' : revealed ? 'Hide' : 'Reveal'}
      </button>
      {/* Announced politely so the reveal isn't silent for a screen reader. */}
      <span className="sr-only" role="status">
        {revealed ? `${fieldLabel} revealed` : ''}
      </span>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

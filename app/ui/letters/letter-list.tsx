import clsx from 'clsx';

import type { IssuedLetter } from '@/app/lib/api/letters';
import { LETTER_STATUS_LABELS } from '@/app/lib/constants';

interface LetterListProps {
  letters: IssuedLetter[];
  /** Download, reissue, countersign — supplied by the screen that knows what it may do. */
  actionsFor?: (letter: IssuedLetter) => React.ReactNode;
  emptyMessage?: string;
}

const STATUS_STYLES: Record<IssuedLetter['status'], string> = {
  // Not red. A composed letter is not an error — it exists and is waiting on a person.
  composed: 'bg-amber-50 text-amber-800 ring-amber-200',
  issued: 'bg-blue-50 text-blue-800 ring-blue-200',
  executed: 'bg-green-50 text-green-800 ring-green-200',
};

const dateText = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : '—';

/**
 * Letters for one subject (017 US6, FR-012).
 *
 * **Issued and executed are distinguishable at a glance**, which is the whole of FR-018:
 * "we sent this" and "they signed it are different claims, and a list that showed one
 * badge for both would lose the second entirely.
 *
 * The subject pair is rendered as it arrives and never resolved into a vendor or project
 * name — this app does not know what a vendor is either, and the screen that does renders
 * its own heading above this list.
 */
export function LetterList({
  letters,
  actionsFor,
  emptyMessage = 'No letters yet.',
}: LetterListProps) {
  if (letters.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {letters.map((letter) => (
        <li
          key={letter.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
              <span className="truncate">{letter.letterKindLabel}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                  STATUS_STYLES[letter.status],
                )}
              >
                {LETTER_STATUS_LABELS[letter.status]}
              </span>
              {letter.version > 1 && (
                <span className="text-xs text-gray-500">
                  v{letter.version}
                </span>
              )}
              {letter.isSuperseded && (
                <span className="text-xs text-gray-500">superseded</span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {letter.issuedAt
                ? `Issued ${dateText(letter.issuedAt)}`
                : 'Not yet issued'}
              {letter.countersignedAt
                ? ` · Executed ${dateText(letter.countersignedAt)}`
                : ''}
              {letter.isSigned ? ' · Signed' : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {actionsFor?.(letter)}
          </div>
        </li>
      ))}
    </ul>
  );
}

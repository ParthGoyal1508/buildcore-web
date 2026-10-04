'use client';

import { useQuery } from '@tanstack/react-query';

import { downloadLetter, getLetters, type LetterQuery } from '@/app/lib/api/letters';
import { LETTER_COPY, MESSAGES } from '@/app/lib/constants';
import { LetterList } from '@/app/ui/letters/letter-list';
import { RowAction } from '@/app/ui/settings/form-fields';

/**
 * The letters belonging to one subject, wherever that subject's own screen is (017 US6, T029, T030).
 *
 * ## Why this is a panel and not three screens
 *
 * A letter is always *about* something — an employee, a candidate, a project, a vendor — and the
 * person who wants to see it is on that thing's screen, not in a letters module. The client's item 18
 * asks for a Letters menu under both Recruitment and Projects for exactly that reason. So the same
 * panel mounts on each, differing only in the query that selects the subject.
 *
 * `LetterList` already renders the rows and already distinguishes issued from executed, which is the
 * whole of FR-018. This adds the fetch, the download, and nothing else — a second list component
 * would be a second place for "we sent this" and "they signed it" to drift apart.
 *
 * ## The subject pair is never resolved here
 *
 * `subjectType`/`subjectId` arrive opaque and stay opaque: this app does not know what a vendor is,
 * and the screen mounting this panel already renders the subject's own name above it. Resolving it
 * here would mean guessing which module owns the pair.
 */
export default function SubjectLetters({
  query,
  heading = LETTER_COPY.subjectHeading,
  emptyMessage = LETTER_COPY.subjectEmpty,
}: {
  /** Exactly one subject's worth — an employee, a candidate, or a subject pair. */
  query: LetterQuery;
  heading?: string;
  emptyMessage?: string;
}) {
  const { data, isLoading, isError } = useQuery({
    // The query in the key, so switching subject refetches rather than showing the last one's
    // letters — the failure mode that looks like it is working.
    queryKey: ['letters', query],
    queryFn: () => getLetters(query),
  });

  const open = async (letterId: string) => {
    const blob = await downloadLetter(letterId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

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
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-gray-900">{heading}</h3>
      <LetterList
        letters={data ?? []}
        emptyMessage={emptyMessage}
        actionsFor={(letter) => (
          // Only the download. Composing belongs on the composer, and issuing belongs behind the
          // approval gate the composer already renders — putting either here would be a second
          // path to an action whose preconditions this panel does not check.
          <RowAction intent="read" type="button" onClick={() => void open(letter.id)}>
            {LETTER_COPY.subjectOpen}
          </RowAction>
        )}
      />
    </section>
  );
}

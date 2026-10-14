'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  downloadLetter,
  getLetters,
  letterFileName,
  type IssuedLetter,
  type LetterQuery,
} from '@/app/lib/api/letters';
import {
  GENERATE_LETTER_COPY,
  LETTER_COPY,
  MESSAGES,
} from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import GenerateLetterDialog, {
  useOfferableLetterKinds,
  type LetterRecipient,
} from '@/app/ui/letters/generate-letter-dialog';
import { LetterList } from '@/app/ui/letters/letter-list';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

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
  also,
  heading = LETTER_COPY.subjectHeading,
  emptyMessage = LETTER_COPY.subjectEmpty,
  generate,
}: {
  /** Exactly one subject's worth — an employee, a candidate, or a subject pair. */
  query: LetterQuery;
  /**
   * A second subject whose letters belong in the same list (2026-10-14) — a candidate who has
   * joined, and the employee record joining created. Two panels listed the appointment letter
   * twice, because it is addressed to both; one list, de-duplicated by letter, says it once.
   */
  also?: LetterQuery;
  heading?: string;
  emptyMessage?: string;
  /**
   * Offer "Generate document" for these kinds (HR documents, 2026-10-13). Only where this panel
   * is not itself inside a dialog — the generate flow is one, and dialogs do not stack here.
   */
  generate?: {
    recipient: LetterRecipient;
    recipientLabel?: string;
    kindKeys: readonly string[];
  };
}) {
  const [generating, setGenerating] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const offerable = useOfferableLetterKinds(
    generate?.kindKeys ?? [],
    !!generate,
  );

  const { data, isLoading, isError } = useQuery({
    // The query in the key, so switching subject refetches rather than showing the last one's
    // letters — the failure mode that looks like it is working.
    queryKey: ['letters', query, also ?? null],
    queryFn: async () => {
      const [first, second] = await Promise.all([
        getLetters(query),
        also ? getLetters(also) : Promise.resolve([]),
      ]);
      const seen = new Set<string>();
      return [...first, ...second].filter((letter) =>
        seen.has(letter.id) ? false : (seen.add(letter.id), true),
      );
    },
  });

  // Read in the page rather than a new tab (2026-10-14): a tab opened after the fetch is one most
  // browsers block as a pop-up, and the shared viewer is what every other PDF here opens in.
  const { view, viewer } = useFileViewer();
  const open = (letter: IssuedLetter) =>
    view({
      title: letter.referenceNo ?? letter.letterKindLabel,
      fileName: letterFileName(letter),
      load: () => downloadLetter(letter.id),
    });

  const save = async (letter: IssuedLetter) => {
    setDownloadError(null);
    try {
      saveBlob(await downloadLetter(letter.id), letterFileName(letter));
    } catch {
      setDownloadError(GENERATE_LETTER_COPY.downloadFailed);
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">{heading}</h3>
        {generate && offerable.kinds.length > 0 && (
          <SecondaryButton type="button" onClick={() => setGenerating(true)}>
            {GENERATE_LETTER_COPY.action}
          </SecondaryButton>
        )}
      </div>
      <FormError message={downloadError} />
      {viewer}
      <LetterList
        letters={data ?? []}
        emptyMessage={emptyMessage}
        actionsFor={(letter) => (
          // Only the download. Composing belongs on the composer, and issuing belongs behind the
          // approval gate the composer already renders — putting either here would be a second
          // path to an action whose preconditions this panel does not check.
          <>
            <RowAction
              intent="read"
              type="button"
              onClick={() => void open(letter)}
            >
              {LETTER_COPY.subjectOpen}
            </RowAction>
            {letter.status !== 'composed' && (
              <RowAction
                intent="read"
                type="button"
                onClick={() => void save(letter)}
              >
                Download
              </RowAction>
            )}
          </>
        )}
      />
      {generate && generating && (
        <GenerateLetterDialog
          recipient={generate.recipient}
          recipientLabel={generate.recipientLabel}
          kindKeys={generate.kindKeys}
          onClose={() => setGenerating(false)}
        />
      )}
    </section>
  );
}

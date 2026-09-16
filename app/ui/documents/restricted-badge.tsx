import { LockClosedIcon } from '@heroicons/react/24/outline';

import { DOCUMENT_COPY } from '@/app/lib/constants';

/**
 * Marks a document kind as regulated personal data (017 FR-013a, backend FR-024).
 *
 * **The badge is not the enforcement.** The server refuses to render a restricted type
 * into any letter and audit-logs every retrieval; this is the part a person sees, so they
 * understand why the document behaves differently from the seven beside it rather than
 * assuming the interface is broken.
 *
 * What it announces is specifically that there is **no preview**. A thumbnail of an
 * Aadhaar card on a settings screen is a disclosure to everyone who walks past the
 * monitor, and it happens without anybody deciding to look.
 */
export function RestrictedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
      title={DOCUMENT_COPY.restrictedNotice}
    >
      <LockClosedIcon className="h-3 w-3" aria-hidden="true" />
      Restricted
    </span>
  );
}

/** The full sentence, for where there is room to say it. */
export function RestrictedNotice() {
  return (
    <p className="text-xs text-amber-800">{DOCUMENT_COPY.restrictedNotice}</p>
  );
}

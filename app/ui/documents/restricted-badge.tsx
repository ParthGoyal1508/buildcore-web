import { LockClosedIcon } from '@heroicons/react/24/outline';

import { DOCUMENT_COPY } from '@/app/lib/constants';
import StatusBadge from '@/app/ui/status-badge';

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
    <span title={DOCUMENT_COPY.restrictedNotice}>
      <StatusBadge
        tone="warning"
        label={'Restricted'}
        icon={LockClosedIcon}
      />
    </span>
  );
}

/** The full sentence, for where there is room to say it. */
export function RestrictedNotice() {
  return (
    <p className="text-xs text-amber-800">{DOCUMENT_COPY.restrictedNotice}</p>
  );
}

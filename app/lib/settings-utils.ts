/** The six display flags a document type can resolve to. */
export type DocumentTypeFlag =
  | 'MandatoryNumber'
  | 'Mandatory'
  | 'ExpiryNumber'
  | 'Expiry'
  | 'Number'
  | 'Optional';

/**
 * Derives a document type's display flag from its three toggles.
 *
 * A deliberate duplicate of the backend's own `computeDocumentTypeFlag`: the API
 * returns the computed flag on every read, but the Add/Edit modal has to show the
 * result *before* saving (spec US5, Acceptance Scenario 1), and there is no server
 * to ask at that point. The branch order below must stay identical to the
 * backend's — mandatory outranks expiry, and each "needs number" pairing is checked
 * before its bare form.
 */
export function computeDocumentTypeFlag(
  isMandatory: boolean,
  hasExpiry: boolean,
  needsNumber: boolean,
): DocumentTypeFlag {
  if (isMandatory && needsNumber) return 'MandatoryNumber';
  if (isMandatory) return 'Mandatory';
  if (hasExpiry && needsNumber) return 'ExpiryNumber';
  if (hasExpiry) return 'Expiry';
  if (needsNumber) return 'Number';
  return 'Optional';
}

/** Formats an ISO timestamp for the Users list's Last Login column, or "Never". */
export function formatLastLogin(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

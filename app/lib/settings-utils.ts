import { dateTimeLabel } from '@/app/lib/format';
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

/**
 * What each derived flag is called on screen.
 *
 * The flag values are wire identifiers — the API computes and returns them, and the
 * branch order in `computeDocumentTypeFlag` *is* the specification, so they cannot be
 * renamed. But the Flags column and the modal's live preview were printing them
 * verbatim, so a reader saw `MandatoryNumber` and `ExpiryNumber`: two words run
 * together, which reads as a rendering fault even though it is a single legitimate
 * value.
 *
 * A middle dot rather than "and": the two halves are independent properties of the
 * document type, not a phrase.
 */
const FLAG_LABELS: Record<DocumentTypeFlag, string> = {
  Mandatory: 'Mandatory',
  MandatoryNumber: 'Mandatory · number required',
  Expiry: 'Has an expiry date',
  ExpiryNumber: 'Has an expiry date · number required',
  Number: 'Number required',
  Optional: 'Optional',
};

/** The flag as a reader should see it. An unrecognised value renders as it arrived. */
export function documentTypeFlagLabel(flag: string): string {
  return FLAG_LABELS[flag as DocumentTypeFlag] ?? flag;
}

/** Formats an ISO timestamp for the Users list's Last Login column, or "Never". */
export function formatLastLogin(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return dateTimeLabel(date);
}

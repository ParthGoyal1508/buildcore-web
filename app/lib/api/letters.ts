import { z } from 'zod';

import { authFetch, authFetchBlob } from '@/app/lib/session';
import { approvalStateSchemaForModules } from '@/app/lib/api/approvals';
import { companyQuery } from '@/app/lib/api/company-query';

/**
 * Every `/letters`, `/letter-kinds` and `/signatories` call (feature 017 US3–US6).
 *
 * Principle V: no component issues its own `fetch()`. Every response is parsed before
 * the app trusts it, and every refusal surfaces as the `ApiError` `app/lib/api/client.ts`
 * throws, carrying the backend's `code` — callers branch on the code, never on the
 * message.
 *
 * ## What this module deliberately does not have
 *
 * **No client-side approval logic.** Not even "the user holds SETTINGS so they can
 * probably issue". Authority resolves from role-slot mappings the browser cannot see,
 * and the server's answer arrives as `approval` on the letter. A browser that guessed
 * would render an Issue button the server refuses — the exact failure web FR-010a exists
 * to prevent.
 *
 * **No client-side list of letter kinds.** They are rows now (backend FR-011): an
 * administrator can define one without a release, and a hardcoded list would be wrong
 * the first time they did.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Letter kinds
// ─────────────────────────────────────────────────────────────────────────────

const letterKindSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  requiresSignature: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  approvalActionType: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  /** True when the product ships this kind: it may not be edited or deleted here. */
  isShipped: z.boolean().default(false),
});
export type LetterKind = z.infer<typeof letterKindSchema>;

export async function getLetterKinds(
  companyId?: string,
): Promise<LetterKind[]> {
  const raw = await authFetch<unknown>(`/letter-kinds${companyQuery(companyId)}`);
  return z.array(letterKindSchema).parse(raw);
}

export interface UpsertLetterKindInput {
  key?: string;
  label: string;
  requiresSignature?: boolean;
  requiresApproval?: boolean;
  approvalActionType?: string;
  isActive?: boolean;
}

/**
 * Defines a new kind, or edits one this company authored.
 *
 * Reusing a product-shipped key is refused with `LETTER_KIND_KEY_RESERVED`: two kinds
 * answering to one key leave every lookup ambiguous with no precedence rule to settle it.
 */
export async function upsertLetterKind(
  input: UpsertLetterKindInput,
  id?: string,
  companyId?: string,
): Promise<LetterKind> {
  const path = id ? `/letter-kinds/${encodeURIComponent(id)}` : '/letter-kinds';
  const raw = await authFetch<unknown>(`${path}${companyQuery(companyId)}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
  return letterKindSchema.parse(raw);
}

/**
 * Deletes a kind nothing references.
 *
 * Refused with `LETTER_KIND_IN_USE` while letters or templates point at it. The screen
 * shows that message verbatim — a generic "could not delete" throws away the only part
 * that says what to do instead.
 */
export async function deleteLetterKind(
  id: string,
  companyId?: string,
): Promise<void> {
  await authFetch<unknown>(
    `/letter-kinds/${encodeURIComponent(id)}${companyQuery(companyId)}`,
    { method: 'DELETE' },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signatories
// ─────────────────────────────────────────────────────────────────────────────

const signatorySchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  isActive: z.boolean().default(true),
});
export type Signatory = z.infer<typeof signatorySchema>;

/**
 * Note what is absent: the signature graphic.
 *
 * The backend exposes no route returning it, and this module asks for none. The image is
 * applied server-side at issue; handing it to a browser would make forging a signed
 * letter a download away.
 */
export async function getSignatories(
  companyId?: string,
): Promise<Signatory[]> {
  const raw = await authFetch<unknown>(`/signatories${companyQuery(companyId)}`);
  return z.array(signatorySchema).parse(raw);
}

export interface UpsertSignatoryInput {
  name: string;
  title: string;
  /** The graphic, base64-encoded. Omit when editing and leaving it unchanged. */
  signature?: string;
  contentType?: string;
  isActive?: boolean;
}

export async function upsertSignatory(
  input: UpsertSignatoryInput,
  id?: string,
  companyId?: string,
): Promise<Signatory> {
  const path = id ? `/signatories/${encodeURIComponent(id)}` : '/signatories';
  const raw = await authFetch<unknown>(`${path}${companyQuery(companyId)}`, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
  return signatorySchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Letters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three states, and the interface renders three different things.
 *
 * `composed` is the one that matters: the letter exists, its approval chain is running,
 * and there is no document yet. FR-018's issued-versus-executed distinction is the other
 * two — "we sent this" and "they signed it" are different claims.
 */
export const LETTER_STATUSES = ['composed', 'issued', 'executed'] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

const issuedLetterSchema = z.object({
  id: z.string(),
  letterKindId: z.string(),
  letterKindKey: z.string(),
  letterKindLabel: z.string(),
  employeeId: z.string().nullable().default(null),
  candidateId: z.string().nullable().default(null),
  /**
   * The opaque subject pair. This app does not resolve it either — the module that owns
   * the subject renders its own name beside the letter list.
   */
  subjectType: z.string().nullable().default(null),
  subjectId: z.string().nullable().default(null),
  version: z.number(),
  isSuperseded: z.boolean().default(false),
  signatoryId: z.string().nullable().default(null),
  isSigned: z.boolean().default(false),
  issuedAt: z.coerce.date().nullable().default(null),
  status: z.enum(LETTER_STATUSES),
  countersignedAt: z.coerce.date().nullable().default(null),
  requiresApproval: z.boolean().default(false),
  /**
   * The 016 approval state, when the kind is gated.
   *
   * Parsed with 016's own schema, imported rather than redeclared. Two schemas for one
   * server shape diverge the first time either changes, which is the failure 016 FR-001
   * exists to prevent — and it is the same reason the composer imports `ActionReview`
   * instead of building a second approval display.
   */
  approval: approvalStateSchemaForModules.nullish().default(null),
});
export type IssuedLetter = z.infer<typeof issuedLetterSchema>;

export interface ComposeLetterInput {
  letterKindKey: string;
  employeeId?: string;
  candidateId?: string;
  subjectType?: string;
  subjectId?: string;
  variables: Record<string, string>;
  signatoryId?: string;
}

/**
 * Composes a letter, issuing it when nothing gates it.
 *
 * A gated kind comes back `status: 'composed'` with its chain raised. That is not an
 * error and must not be rendered as one: the letter is waiting on a person, and
 * `ActionReview` says which.
 */
export async function composeLetter(
  input: ComposeLetterInput,
): Promise<IssuedLetter> {
  const raw = await authFetch<unknown>('/letters', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return issuedLetterSchema.parse(raw);
}

/**
 * Issues a composed letter.
 *
 * Refused with 016's `APPROVAL_NOT_COMPLETE` while the chain is unfinished. The composer
 * does not offer this control until the chain completes — this function exists for the
 * moment it does, not as something to call optimistically and handle the failure of.
 */
export async function issueLetter(
  letterId: string,
  variables: Record<string, string>,
): Promise<IssuedLetter> {
  const raw = await authFetch<unknown>(
    `/letters/${encodeURIComponent(letterId)}/issue`,
    { method: 'POST', body: JSON.stringify({ variables }) },
  );
  return issuedLetterSchema.parse(raw);
}

/** Corrects an issued letter: supersedes it, and both versions stay retrievable. */
export async function reissueLetter(
  letterId: string,
  variables: Record<string, string>,
  signatoryId?: string,
): Promise<IssuedLetter> {
  const raw = await authFetch<unknown>(
    `/letters/${encodeURIComponent(letterId)}/reissue`,
    { method: 'POST', body: JSON.stringify({ variables, signatoryId }) },
  );
  return issuedLetterSchema.parse(raw);
}

/** Attaches the executed copy that came back signed (FR-012). */
export async function uploadCountersigned(
  letterId: string,
  input: { data: string; contentType: string },
): Promise<IssuedLetter> {
  const raw = await authFetch<unknown>(
    `/letters/${encodeURIComponent(letterId)}/countersigned`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return issuedLetterSchema.parse(raw);
}

export interface LetterQuery {
  subjectType?: string;
  subjectId?: string;
  employeeId?: string;
  candidateId?: string;
  includeSuperseded?: boolean;
}

export async function getLetters(
  query: LetterQuery = {},
): Promise<IssuedLetter[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const raw = await authFetch<unknown>(`/letters${suffix}`);
  return z.array(issuedLetterSchema).parse(raw);
}

/**
 * The document, exactly as issued.
 *
 * Also the preview path: the composer previews by issuing nothing and asking the server
 * to render, so what is previewed came through the same code as the real document. A
 * browser-side re-render is an approximation by construction, and the spec says an
 * approximation is worse than no preview at all.
 */
export async function downloadLetter(letterId: string): Promise<Blob> {
  return authFetchBlob(`/letters/${encodeURIComponent(letterId)}/download`);
}

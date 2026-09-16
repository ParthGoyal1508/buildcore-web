import { z } from 'zod';

import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/company-documents` call to `buildcore-api` (feature 017 US1).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts it,
 * and the `z.infer` type is what the UI consumes.
 *
 * Schemas were checked against the shipped backend's `CompanyDocumentView` and
 * `CompanyDocumentCompleteness`, not against `data-model.md`. Feature 005 shipped six
 * schema mismatches by trusting the document, and 016's `insufficient_authority` was a
 * seventh.
 */

/** One stored document, as the interface renders it. */
const companyDocumentSchema = z.object({
  id: z.string(),
  documentTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  /**
   * Regulated personal data — Aadhaar today. The flag drives FR-013a: a restricted kind
   * renders download-only, never inline, and never in a template field picker.
   */
  isRestricted: z.boolean().default(false),
  documentNumber: z.string().nullable().default(null),
  expiresAt: z.coerce.date().nullable().default(null),
  uploadedAt: z.coerce.date(),
  isCurrent: z.boolean().default(true),
});
export type CompanyDocument = z.infer<typeof companyDocumentSchema>;

/**
 * A required kind this company does not hold.
 *
 * `documentTypeId` is nullable and the null means something specific: the company has
 * never even defined a `DocumentType` for this code, so the interface must offer to
 * create the type rather than an upload. "Defined but not uploaded" and "never defined"
 * are different problems with different next steps.
 */
const missingKindSchema = z.object({
  code: z.string(),
  label: z.string(),
  documentTypeId: z.string().nullable().default(null),
});
export type MissingKind = z.infer<typeof missingKindSchema>;

const completenessSchema = z.object({
  present: z.array(companyDocumentSchema),
  missing: z.array(missingKindSchema),
  expiringSoon: z.array(companyDocumentSchema).default([]),
});
export type CompanyDocumentCompleteness = z.infer<typeof completenessSchema>;

/**
 * The company's documents, and which required kinds are missing.
 *
 * **The missing list is the server's answer, not something this module derives.** The
 * required set is company configuration and can change without a frontend release; a
 * browser computing it would be wrong the first time somebody changed it.
 */
export async function getCompanyDocuments(): Promise<CompanyDocumentCompleteness> {
  const raw = await authFetch<unknown>('/company-documents');
  return completenessSchema.parse(raw);
}

export interface UploadCompanyDocumentInput {
  documentTypeId: string;
  /** The file, base64-encoded — the transport 015 established for punch photos. */
  data: string;
  contentType: string;
  documentNumber?: string;
  /** Required when the kind expires; the form asks first so the server need not refuse. */
  expiresAt?: string;
}

/**
 * Uploads a document, superseding any current version of the same kind.
 *
 * There is deliberately no `deleteCompanyDocument`. FR-006 retains superseded documents
 * rather than replacing them, so "replace" is an upload — and the backend offers no
 * delete verb for a statutory paper.
 */
export async function uploadCompanyDocument(
  input: UploadCompanyDocumentInput,
): Promise<CompanyDocument> {
  const raw = await authFetch<unknown>('/company-documents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return companyDocumentSchema.parse(raw);
}

/**
 * Uploading a new version of a kind IS the supersede — same call, same endpoint.
 *
 * Named separately because the screen's two actions read differently to a person
 * ("upload" when nothing is there, "replace" when something is), and a component
 * branching on which word to use should not also have to know they are one request.
 */
export const supersedeCompanyDocument = uploadCompanyDocument;

/** Every version of one kind, newest first — the history FR-006 preserves. */
export async function getCompanyDocumentHistory(
  documentTypeId: string,
): Promise<CompanyDocument[]> {
  const raw = await authFetch<unknown>(
    `/company-documents/${encodeURIComponent(documentTypeId)}/history`,
  );
  return z.array(companyDocumentSchema).parse(raw);
}

/**
 * The file itself.
 *
 * Reuses `authFetchBlob` rather than adding a transport: an expired token has to be
 * renewed the same way whatever the response body turns out to be. Every retrieval is
 * audit-logged server-side **before** the bytes are sent (backend FR-024), which is why
 * a restricted kind has no inline preview — there is no way to look at one without the
 * look being recorded, and that is the point.
 */
export async function downloadCompanyDocument(id: string): Promise<Blob> {
  return authFetchBlob(
    `/company-documents/${encodeURIComponent(id)}/download`,
  );
}

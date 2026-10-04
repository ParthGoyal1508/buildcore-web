import { z } from 'zod';

import { authFetch, authFetchFile } from '@/app/lib/session';
import type { StoredFile } from '@/app/lib/api/client';
import { companyQuery } from '@/app/lib/api/company-query';

/**
 * Every `/projects/document-requirements` call, plus project readiness (017 US2).
 *
 * Principle V: no component issues its own `fetch()`, and every response is parsed
 * before the app trusts it.
 */

const requirementSchema = z.object({
  documentTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  isMandatory: z.boolean().default(true),
});
export type ProjectDocumentRequirement = z.infer<typeof requirementSchema>;

/**
 * A kind that may be required of a project, whether or not it currently is (FR-007a).
 *
 * `.default([])` so a client deployed ahead of the server degrades to the read-only list
 * rather than failing to parse the whole response.
 */
const availableTypeSchema = z.object({
  documentTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  isRequired: z.boolean().default(false),
});
export type AvailableDocumentType = z.infer<typeof availableTypeSchema>;

const requirementSetSchema = z.object({
  requirements: z.array(requirementSchema),
  /**
   * True when the company has configured nothing and the shipped set applies.
   *
   * Surfaced rather than hidden: "you are using the defaults" and "you chose exactly
   * these six" are different facts, and an administrator deciding whether to edit them
   * needs to know which one they are looking at.
   */
  usingDefaults: z.boolean().default(false),
  /**
   * Required kinds the company has no document type for, so they cannot be required yet.
   * Named rather than silently dropped — otherwise a missing type quietly shrinks the
   * required set and nobody sees the sixth kind disappear.
   */
  undefinedCodes: z.array(z.string()).default([]),
  /** What may be required — the list an editor picks from (FR-007a). */
  availableTypes: z.array(availableTypeSchema).default([]),
});
export type ProjectDocumentRequirementSet = z.infer<
  typeof requirementSetSchema
>;

/** How far one project is from fully papered. */
export const projectReadinessSchema = z.object({
  required: z.number(),
  present: z.number(),
  missingTypeIds: z.array(z.string()).default([]),
  /**
   * The advisory kinds, counted **separately** (FR-022a).
   *
   * `required`/`present`/`missingTypeIds` above continue to mean *mandatory* only — the figures
   * every existing screen shows — so an advisory kind cannot make a complete project read as
   * short. These are additive and optional, so a client ahead of the server degrades to not
   * reporting them rather than failing to parse the project list.
   *
   * Why both exist at all: "we cannot start this project" and "we are still chasing paperwork"
   * are different sentences, and a single pair of figures can only say one of them.
   */
  advisoryRequired: z.number().optional(),
  advisoryPresent: z.number().optional(),
  advisoryMissingTypeIds: z.array(z.string()).optional().default([]),
});
export type ProjectDocumentReadiness = z.infer<typeof projectReadinessSchema>;

/**
 * One document filed against a project — required or supplementary (FR-024).
 *
 * `documentTypeId` is null for a supplementary document, which is what "supplementary" means on
 * the column rather than a second flag saying the same thing. `documentType` is the free-text
 * label and is always present.
 */
export const projectDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  documentType: z.string(),
  documentTypeId: z.string().nullable(),
  remark: z.string().nullable().optional(),
  uploadedAt: z.string(),
  uploadedByUserId: z.string(),
  /** Resolved server-side. Null when the account has gone — the document is still the point. */
  uploadedByName: z.string().nullable().optional(),
});
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

/**
 * Every document filed against a project, **unfiltered**.
 *
 * Deliberately not narrowed to the required set. Filtering is exactly what made supplementary
 * company documents invisible and produced this feature's amendment D1, and the same mistake is
 * available here — "3 of 5 required" cannot answer "what do we hold for this project", which is
 * where the client's item 3 ends.
 */
export async function getProjectDocuments(
  projectId: string,
  companyId?: string,
): Promise<ProjectDocument[]> {
  const raw = await authFetch<unknown>(
    `/projects/${encodeURIComponent(projectId)}/documents${companyQuery(companyId)}`,
  );
  return z.array(projectDocumentSchema).parse(raw);
}

/** The bytes, as a blob the caller turns into a download. */
export async function downloadProjectDocument(
  projectId: string,
  documentId: string,
  companyId?: string,
): Promise<StoredFile> {
  return authFetchFile(
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(
      documentId,
    )}/download${companyQuery(companyId)}`,
  );
}


/**
 * Files a document against a project that already exists (backend FR-008a).
 *
 * Missing until 2026-10-04, which meant a project's documents could only be attached while it
 * was being *created*: the panel named what was outstanding and offered no way to supply it, and
 * a project that went live without its insurance could never be brought up to date. The endpoint
 * had been there since 017.
 *
 * `documentType` is the kind's own label, sent alongside the id because the server stores both —
 * the id is what readiness matches on, the label is what the document reads as on screen, and it
 * survives the kind being renamed afterwards.
 */
export async function uploadProjectDocument(
  projectId: string,
  input: {
    documentTypeId?: string;
    documentType: string;
    /** Base64, without a data-URL prefix. */
    data: string;
    contentType: string;
    fileName?: string;
    remark?: string;
  },
  companyId?: string,
): Promise<ProjectDocument> {
  const raw = await authFetch<unknown>(
    `/projects/${encodeURIComponent(projectId)}/documents${companyQuery(companyId)}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return projectDocumentSchema.parse(raw);
}

/**
 * Brings a declared project kind into existence (backend FR-007a).
 *
 * For a code `undefinedCodes` reports. Only the code travels — the server takes the
 * name, flags and scope from its own configuration, and refuses any code outside the six
 * FR-007 names, which is what keeps this from reaching the company's own kinds.
 */
export async function defineProjectDocumentKind(
  code: string,
  companyId?: string,
): Promise<{ documentTypeId: string; code: string; name: string }> {
  const raw = await authFetch<unknown>(
    `/projects/document-requirements/kinds/${encodeURIComponent(code)}${companyQuery(companyId)}`,
    { method: 'POST' },
  );
  return z
    .object({ documentTypeId: z.string(), code: z.string(), name: z.string() })
    .parse(raw);
}

export async function getDocumentRequirements(
  companyId?: string,
): Promise<ProjectDocumentRequirementSet> {
  const raw = await authFetch<unknown>(
    `/projects/document-requirements${companyQuery(companyId)}`,
  );
  return requirementSetSchema.parse(raw);
}

/**
 * Replaces the whole required set.
 *
 * A PUT that replaces rather than a POST that appends, matching the backend: the
 * required set is a set, and "remove LOI from the requirements" has no other honest
 * expression.
 */
export async function putDocumentRequirements(
  requirements: { documentTypeId: string; isMandatory?: boolean }[],
  companyId?: string,
): Promise<ProjectDocumentRequirementSet> {
  const raw = await authFetch<unknown>(
    `/projects/document-requirements${companyQuery(companyId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ requirements }),
    },
  );
  return requirementSetSchema.parse(raw);
}

/**
 * Readiness comes back **inside the project list**, not from a call per project.
 *
 * There is deliberately no `getProjectReadiness(projectIds)` issuing its own request.
 * The backend attaches readiness to `GET /projects?include=documentReadiness` in one
 * batch, and a separate endpoint here would invite exactly the per-row request the
 * batch exists to prevent — quickstart Pass 7 counts the requests in the Network tab
 * and expects one.
 *
 * `app/lib/api/projects.ts` owns the list call; this constant is the flag it passes.
 */
export const INCLUDE_DOCUMENT_READINESS = 'documentReadiness';

/**
 * Stages one document before its project exists (FR-009b).
 *
 * **The reference is the caller's alone.** Creation refuses a staged id uploaded by anybody else,
 * and refuses it with the same code as a nonexistent one — so the refusal cannot be used to
 * discover that somebody else staged something. Unused references are swept with their files after
 * the staging window, so an abandoned form costs nothing permanent.
 */
export async function stageProjectDocument(
  input: {
    documentTypeId?: string;
    documentType: string;
    /** Base64, without a data-URL prefix. */
    data: string;
    contentType: string;
    /** The uploader's own file name, so the download is what they recognise. */
    fileName?: string;
  },
  companyId?: string,
): Promise<{ stagedDocumentId: string }> {
  const raw = await authFetch<unknown>(
    `/projects/document-uploads${companyQuery(companyId)}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  // Tolerant of the id's field name, because the route's own description calls it
  // `stagedDocumentId` while a bare `id` is the shape every other create here returns.
  const parsed = z
    .object({ stagedDocumentId: z.string().optional(), id: z.string().optional() })
    .parse(raw);
  const stagedDocumentId = parsed.stagedDocumentId ?? parsed.id;
  if (!stagedDocumentId) {
    throw new Error('The upload did not return a reference.');
  }
  return { stagedDocumentId };
}

/** Reads a File as base64 without the data-URL prefix the API does not want. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () =>
      reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

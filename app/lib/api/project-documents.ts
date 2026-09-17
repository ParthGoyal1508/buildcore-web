import { z } from 'zod';

import { authFetch } from '@/app/lib/session';
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
});
export type ProjectDocumentReadiness = z.infer<typeof projectReadinessSchema>;


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

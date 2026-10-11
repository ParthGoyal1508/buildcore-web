import { z } from "zod";

import { authFetch } from "@/app/lib/session";

/**
 * The company's standard terms and conditions, per kind of document (2026-10-11).
 *
 * One module per domain, per Principle V, and every response parsed before the app
 * trusts it (Principle IV).
 */

/** Mirrors `settings.TermsDocumentKind` exactly. */
export const TERMS_DOCUMENT_KINDS = [
  "work_order",
  "letter_of_intent",
  "purchase_order",
] as const;
export type TermsDocumentKind = (typeof TERMS_DOCUMENT_KINDS)[number];

const termsTemplateSchema = z.object({
  documentKind: z.enum(TERMS_DOCUMENT_KINDS),
  body: z.string(),
  /**
   * False while the company is still on the set this product ships.
   *
   * The distinction the screen needs: "nobody has reviewed these" is a different
   * sentence from "somebody wrote these and they happen to read like the default",
   * and only the first is worth saying out loud.
   */
  isCustomised: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type TermsTemplate = z.infer<typeof termsTemplateSchema>;

export async function getTerms(): Promise<TermsTemplate[]> {
  return z
    .array(termsTemplateSchema)
    .parse(await authFetch<unknown>("/settings/terms"));
}

export async function putTerms(
  documentKind: TermsDocumentKind,
  body: string,
): Promise<TermsTemplate> {
  return termsTemplateSchema.parse(
    await authFetch<unknown>("/settings/terms", {
      method: "PUT",
      body: JSON.stringify({ documentKind, body }),
    }),
  );
}

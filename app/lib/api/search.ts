import { z } from 'zod';

import { ROUTES } from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';

/**
 * Cross-register search (021 US1, FR-001 to FR-005) — the client's item 4.
 *
 * One request reaches four registers. The backend's `/search` controller carries no
 * `@RequirePermissions` on purpose — a route-level guard would have to name one
 * register's permission and would then be wrong for the other three — and authorises
 * **per register** inside its registry instead.
 *
 * The consequence this module exists to respect: **a register the caller may not see
 * contributes nothing and is never named.** It does not appear in `unavailableSources`,
 * because that would disclose the register's existence. FR-005 is enforced server-side,
 * and the only way this app can break it is by rendering something the response does not
 * contain — see `dashboard-search.tsx`.
 */

export const SEARCH_REGISTERS = [
  'employee',
  'vendor',
  'equipment',
  'project',
] as const;
export type SearchRegister = (typeof SEARCH_REGISTERS)[number];

const searchResultSchema = z.object({
  register: z.enum(SEARCH_REGISTERS),
  id: z.string(),
  /** The register's own code. */
  code: z.string(),
  /** What a person reads. */
  label: z.string(),
  /**
   * One disambiguating fact, for two records sharing a name.
   *
   * This is the backend's answer to FR-002's "identify each record sufficiently to
   * choose between similar ones", so rendering it is the requirement rather than a
   * nicety — two projects both called "Phase 2" are otherwise indistinguishable.
   */
  sublabel: z.string().nullable(),
  /**
   * Why this row is in the list.
   *
   * Rendered, per FR-001b: to somebody who typed something code-shaped, an unexplained
   * name match reads as a wrong result.
   */
  matchedOn: z.enum(['code', 'name']),
  /**
   * Where the record lives **on the backend** — e.g. `/hr/employees/:id`.
   *
   * Deliberately **not** used for navigation. I originally wired the result rows straight
   * to this, reasoning that composing a route here would be a second place that knows
   * where a vendor lives. That was backwards, and it shipped a 404: these are API resource
   * paths, and the backend cannot know this app's routing — every screen here sits under
   * `/dashboard`, a project's record is at `/projects/portfolio/:id/edit`, and a vendor has
   * no detail page at all. The server was never in a position to be right about any of
   * that.
   *
   * Kept on the type because it is genuinely useful — it identifies the resource, and a
   * different client with different routes would map it differently — but navigation goes
   * through `resultHref` below, which reads this app's own `ROUTES`.
   */
  href: z.string(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

const searchResponseSchema = z.object({
  /** Exact code matches first (FR-001b), then everything else. */
  results: z.array(searchResultSchema),
  /**
   * A cap was hit and there are more matches than are shown.
   *
   * Must be rendered. Showing thirty rows and saying nothing is a quieter version of
   * the failure FR-005 is about: the reader concludes they have seen everything.
   */
  truncated: z.boolean(),
  /**
   * Registers whose module could not be asked — not deployed, or it threw.
   *
   * **Never a register the caller lacks permission for.** So rendering this discloses
   * nothing: it can only ever name a register the caller is already entitled to search.
   * And it must be rendered, because a register that threw otherwise reads as a register
   * with no matches, which is a different and worse answer.
   */
  unavailableSources: z.array(z.string()),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * The shortest term the backend will accept.
 *
 * Mirrors its `SEARCH_MIN_TERM_LENGTH` default. The backend enforces this as a
 * **validator**, so a shorter term is a 400 and not an empty list — deliberately, because
 * "keep typing" and "nothing matched" are different facts and a client handed an empty
 * array cannot tell them apart. This constant keeps the control from sending a request it
 * knows will be refused.
 *
 * Both sides read an environment variable, so the two can in principle diverge. If the
 * backend's minimum is raised above this, the symptom is a 400 surfacing as a failed
 * search rather than as "keep typing" — which is why the control treats a 400 as the
 * too-short state rather than as an error.
 */
export const SEARCH_MIN_TERM_LENGTH = Number(
  process.env.NEXT_PUBLIC_SEARCH_MIN_TERM_LENGTH ?? 3,
);

export async function search(term: string): Promise<SearchResponse> {
  return searchResponseSchema.parse(
    await authFetch(`/search?q=${encodeURIComponent(term)}`),
  );
}

/**
 * Where a result goes **in this app**.
 *
 * `ROUTES` is the single source of truth for this app's URLs, so the mapping belongs here
 * rather than on the server — see the note on `href` above for the 404 that proved it.
 *
 * Two registers have no detail screen, and this returns the closest honest destination
 * rather than a URL that does not resolve:
 *
 * - **Vendor** → the vendors list. Vendors are edited in a modal on that list, so there is
 *   no per-vendor route to send anyone to. The reader lands where the vendor is findable.
 * - **Project** → the project's edit screen. `/dashboard/projects/portfolio/[id]` has no
 *   page of its own; only `edit` and `documents` exist beneath it.
 *
 * Both are worth closing properly with real detail screens, and neither is this feature's
 * work. Until then a search result reaches something that loads.
 */
export function resultHref(result: SearchResult): string {
  switch (result.register) {
    case 'employee':
      return ROUTES.hrEmployee(result.id);
    case 'equipment':
      return ROUTES.plantEquipmentDetail(result.id);
    case 'project':
      return ROUTES.projectsEditProject(result.id);
    case 'vendor':
      return ROUTES.partnersVendors;
  }
}

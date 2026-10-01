import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * A company this caller may work in (019 FR-001, FR-008).
 *
 * Deliberately not the same thing as `listActiveCompanies()` in `settings.ts`, which answers "what
 * companies exist" for an administration screen. This answers "which of them are *mine*", and the
 * backend derives it from the caller's own permissions — so a single-company user gets exactly one
 * element and the switcher knows not to appear, without a second call to ask.
 */
const selectableCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * Whether this is the company the caller is working in **right now**.
   *
   * The server resolves it from the session and marks exactly one element, so the switcher never has
   * to guess. Guessing is what the retired `CompanyProvider` did — it defaulted to the first active
   * company — and defaulting to `companies[0]` here would rebuild the same bug behind a new control:
   * a select that confidently names a company the session is not in.
   *
   * There is deliberately no `shortCode`. The backend's `selectableFor` returns id and name only,
   * and a schema asking for a third field would silently drop it anyway — a zod object strips what
   * it does not declare, which is exactly how this client discarded the permission levels the server
   * had been sending all along.
   */
  selected: z.boolean(),
});

export type SelectableCompany = z.infer<typeof selectableCompanySchema>;

const selectableResponseSchema = z.array(selectableCompanySchema);

/** The companies the caller may work in. One element means no switcher (FR-001). */
export async function listSelectableCompanies(): Promise<SelectableCompany[]> {
  return selectableResponseSchema.parse(
    await authFetch<unknown>('/settings/companies/selectable'),
  );
}

/**
 * Chooses the company to work in (FR-003).
 *
 * **Sends only the id, and reads nothing back but confirmation.** The response deliberately carries
 * no lists: one that re-sent every affected collection would become a second source of truth for
 * every screen showing one, and the screens already know how to fetch their own data. What the
 * caller must do instead is discard its cache — see `switchCompany` below, which is the only way
 * this should be called.
 *
 * Takes effect on **subsequent** requests. A request already in flight when this resolves was
 * scoped to the previous company and will come back that way, which is the other reason the cache
 * is cleared rather than selectively invalidated.
 */
export async function setCompanySelection(companyId: string): Promise<void> {
  await authFetch<unknown>('/my/company-selection', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  });
}

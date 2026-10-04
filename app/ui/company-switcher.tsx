'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  listSelectableCompanies,
  setCompanySelection,
} from '@/app/lib/api/company-selection';
import { COMPANY_SWITCHER } from '@/app/lib/constants';
import { hasUnsavedChanges, unsavedScreens } from '@/app/lib/unsaved-changes';
import { inlineSelectClass } from '@/app/ui/settings/form-fields';

/**
 * The key this control's own query lives under.
 *
 * Named because two places now refer to it — the query and the sweep that must skip it — and a
 * second inline copy of `['companies', 'selectable']` would be a typo away from the sweep resetting
 * the list the switcher renders from.
 */
const SELECTABLE_COMPANIES_KEY = ['companies', 'selectable'] as const;

const isSelectableCompanies = (key: readonly unknown[]): boolean =>
  key.length === SELECTABLE_COMPANIES_KEY.length &&
  SELECTABLE_COMPANIES_KEY.every((part, index) => key[index] === part);

/**
 * Chooses which company the whole application is working in (019 FR-001 – FR-006).
 *
 * **Visible only when the caller has more than one company to choose between** (FR-001). Not when
 * they hold `CROSS_COMPANY_ACCESS`, which is what the retired `CompanyProvider` keyed on and is a
 * different population: a permission is about what somebody may reach, and the question here is
 * whether there is a choice to make. A single-company user with the permission got a selector with
 * one entry in it; a user with two companies and no permission got none at all.
 *
 * The backend answers the population question directly, so there is nothing to infer here — one
 * element back means no switcher.
 */
export default function CompanySwitcher() {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);

  const { data: companies } = useQuery({
    queryKey: SELECTABLE_COMPANIES_KEY,
    queryFn: listSelectableCompanies,
  });

  /**
   * The id shown while a switch is in flight.
   *
   * Local, because the authority is the server: the selection lives in the session, and after a
   * successful switch every list on screen refetches against it. Holding the selection in state as
   * the *source of truth* is precisely what made the retired provider wrong — a switch there never
   * reached the server, so the interface and the data disagreed about which company was current.
   */
  const [pending, setPending] = useState<string | null>(null);

  const switchCompany = useMutation({
    mutationFn: setCompanySelection,
    onSuccess: () => {
      /**
       * FR-005. Everything cached was fetched against the previous company.
       *
       * A curated list of invalidations was considered and rejected. It passes review, and then it
       * fails the first time somebody adds a query without thinking about companies — which is to
       * say it fails later, quietly, on a screen nobody was watching, showing one company's figures
       * under another company's name. An unfiltered sweep is blunt and cannot rot.
       *
       * **`resetQueries()`, not `clear()`** — bug report 2026-10-03, where a switch changed the name
       * in this control and nothing else on screen until the page was reloaded. `clear()` removes
       * every query from the cache and destroys it, but it pushes no result to the observers that
       * were watching: nothing re-renders, so no query is rebuilt, so nothing refetches, and the
       * previous company's rows sit under the new company's name — the exact disagreement this
       * component exists to prevent, reintroduced by the call meant to prevent it.
       *
       * `resetQueries()` does both halves: it drops the data *and* returns every active observer to
       * its loading state and refetches it. Returning to loading matters as much as the refetch —
       * the alternative shows the old company's figures while the new ones are in flight, and a
       * reader who glances during that window has no way to know which company they are looking at.
       */
      void queryClient.resetQueries({
        predicate: (query) => !isSelectableCompanies(query.queryKey),
      });
      /**
       * This control's own list is invalidated rather than reset, and `pending` is held until it
       * settles.
       *
       * Resetting it would empty `companies` for as long as the refetch took, and the guard below
       * renders nothing without at least two — so the switcher would vanish from the top bar in the
       * middle of a switch and reappear a moment later. Invalidating keeps the previous list on
       * screen while the new `selected` flag is fetched, which is safe precisely because the set of
       * companies somebody may work in does not change when they switch between them.
       */
      void queryClient
        .invalidateQueries({ queryKey: SELECTABLE_COMPANIES_KEY })
        .finally(() => setPending(null));
    },
    onError: () => {
      // Back to whatever the server last confirmed. A select left showing a company the session is
      // not actually in is the disagreement this whole component exists to remove.
      setPending(null);
      setFailed(true);
    },
  });

  // FR-001: nothing to choose between, nothing to render. Also covers the loading window, where a
  // switcher with no options would appear and then vanish.
  if (!companies || companies.length < 2) return null;

  /**
   * The server's answer, or the honest absence of one.
   *
   * **A cross-company caller who has never used this control has selected nothing**, and the backend
   * then scopes nothing: `companyScope()` widens for them, so every list really does show every
   * company's rows. No element comes back marked `selected` in that state.
   *
   * Showing `companies[0]` here would be a lie with consequences — the control would name one
   * company while the figures beside it were three companies added together, which is precisely the
   * class of bug the retired provider produced. So the unselected state gets its own option, saying
   * what is actually on screen, and picking a real company is the action that narrows it.
   */
  const selectedId = companies.find((company) => company.selected)?.id ?? '';

  const handleChange = (companyId: string) => {
    /**
     * FR-006. A switch discards every cached view, so an unsaved form is lost with them.
     *
     * Covers the forms that register with `useUnsavedChanges`. Those are the only ones it can
     * cover — a switch cannot know about work nobody declared — which is why the message names the
     * screens rather than claiming to speak for the whole application.
     */
    if (hasUnsavedChanges()) {
      const screens = unsavedScreens().join(', ');
      if (!window.confirm(COMPANY_SWITCHER.confirmDiscard(screens))) return;
    }
    setFailed(false);
    setPending(companyId);
    switchCompany.mutate(companyId);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="company-switcher"
        className="hidden text-sm font-medium text-gray-500 sm:block"
      >
        {COMPANY_SWITCHER.label}
      </label>
      <select
        id="company-switcher"
        // `pending` only while a switch is in flight; otherwise the company the **server** says we
        // are in, which arrives with the refetched list the switch invalidated.
        value={pending ?? selectedId}
        disabled={switchCompany.isPending}
        onChange={(event) => handleChange(event.target.value)}
        className={inlineSelectClass}
      >
        {/* Only while nothing is selected, and deliberately not re-selectable: there is no
            "unchoose" on the API, and offering one would imply a caller can widen their own scope
            back out, which the backend does not allow once a selection exists. */}
        {selectedId === '' && (
          <option value="" disabled>
            {COMPANY_SWITCHER.allCompanies}
          </option>
        )}
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      {failed && (
        // Visible rather than a toast that may already have gone: the consequence of a silently
        // failed switch is reading one company's numbers believing they are another's.
        <p role="alert" className="text-sm text-red-600">
          {COMPANY_SWITCHER.switchFailed}
        </p>
      )}
    </div>
  );
}

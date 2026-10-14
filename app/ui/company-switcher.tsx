'use client';

import {
  BuildingOffice2Icon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  listSelectableCompanies,
  setCompanySelection,
} from '@/app/lib/api/company-selection';
import { COMPANY_SWITCHER } from '@/app/lib/constants';
import { COMPANY_LOGO_KEY, CompanyMark } from '@/app/ui/company-logo';
import { hasUnsavedChanges, unsavedScreens } from '@/app/lib/unsaved-changes';
import { confirmDialog } from '@/app/ui/dialogs';

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
 * Queries a company switch must not reset: the switcher's own list, and the company logos.
 *
 * The logos are keyed by company id *and* logo version (see `company-logo.tsx`), so a cached
 * one can never be the wrong company's or an out-of-date image — there is nothing for the sweep
 * to protect against. Resetting them is what made every switch re-download the mark the shell
 * was about to show (2026-10-14).
 */
const survivesSwitch = (key: readonly unknown[]): boolean =>
  isSelectableCompanies(key) || key[0] === COMPANY_LOGO_KEY;

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Closes on a click anywhere else, as a menu does.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

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
    onSuccess: (companies) => {
      /**
       * The list first, from the response itself (2026-10-14), so the shell — the logo above
       * all — knows the new company in the same render that resets everything else, instead of
       * after a refetch that waited its turn behind every other reset query.
       */
      queryClient.setQueryData(SELECTABLE_COMPANIES_KEY, companies);
      setPending(null);
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
        predicate: (query) => !survivesSwitch(query.queryKey),
      });
      // This control's own list is not reset: it was just replaced with the server's answer
      // above, and resetting it would empty `companies` for a moment — the guard below renders
      // nothing without at least two, so the switcher would blink out of the top bar mid-switch.
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

  const handleChange = async (companyId: string) => {
    /**
     * FR-006. A switch discards every cached view, so an unsaved form is lost with them.
     *
     * Covers the forms that register with `useUnsavedChanges`. Those are the only ones it can
     * cover — a switch cannot know about work nobody declared — which is why the message names the
     * screens rather than claiming to speak for the whole application.
     */
    if (hasUnsavedChanges()) {
      const screens = unsavedScreens().join(', ');
      if (
        !(await confirmDialog({
          title: 'Discard unsaved changes?',
          message: COMPANY_SWITCHER.confirmDiscard(screens),
          confirmLabel: 'Switch company',
          tone: 'danger',
        }))
      )
        return;
    }
    setFailed(false);
    setPending(companyId);
    switchCompany.mutate(companyId);
  };

  const selected = companies.find(
    (company) => company.id === (pending ?? selectedId),
  );

  // A menu of its own rather than a native <select> (2026-10-15): the browser's own list
  // rendered as an OS menu that matched nothing around it on the navy bar. Each company shows
  // its logo, so the choice reads the way the sidebar will look after it.
  return (
    <div
      className="relative flex min-w-0 items-center gap-2"
      ref={containerRef}
    >
      <span className="hidden text-sm font-medium text-white/70 sm:block">
        {COMPANY_SWITCHER.label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${COMPANY_SWITCHER.label}: ${selected?.name ?? COMPANY_SWITCHER.allCompanies}`}
        disabled={switchCompany.isPending}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="flex h-10 min-w-0 max-w-[18rem] items-center gap-2 rounded-lg border border-white/15 bg-white/10 pl-2 pr-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 disabled:opacity-60"
      >
        <BuildingOffice2Icon
          className="h-5 w-5 shrink-0 text-accent-300"
          aria-hidden="true"
        />
        <span className="truncate">
          {selected?.name ?? COMPANY_SWITCHER.allCompanies}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={COMPANY_SWITCHER.label}
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-xl ring-1 ring-black/5"
        >
          {companies.map((company) => {
            const isSelected = company.id === (pending ?? selectedId);
            return (
              <li key={company.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  autoFocus={isSelected}
                  onClick={() => {
                    setOpen(false);
                    if (!isSelected) void handleChange(company.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 ${
                    isSelected
                      ? 'bg-brand-50 font-semibold text-brand-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-gray-50 p-1 ring-1 ring-gray-200">
                    <CompanyMark company={company} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {company.name}
                  </span>
                  {isSelected && (
                    <CheckIcon
                      className="h-4 w-4 shrink-0 text-accent-600"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {failed && (
        <p role="alert" className="text-sm text-red-200">
          {COMPANY_SWITCHER.switchFailed}
        </p>
      )}
    </div>
  );
}

'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  SEARCH_MIN_TERM_LENGTH,
  SEARCH_REGISTERS,
  resultHref,
  search,
  type SearchRegister,
  type SearchResult,
} from '@/app/lib/api/search';
import { SEARCH_COPY, SEARCH_DEBOUNCE_MS } from '@/app/lib/constants';

/**
 * Find any record by its code or its name, from the dashboard (021 US1) — the client's
 * item 4, which they asked for twice.
 *
 * ## The rule that governs this whole component
 *
 * FR-005: an empty result says so plainly and **must not reveal that a matching record
 * the user may not see exists**. The backend holds this carefully — a register the caller
 * lacks permission for contributes nothing and is deliberately absent from
 * `unavailableSources`, so its existence is never disclosed.
 *
 * Every natural way to write a helpful search UI undoes that, so the rule here is narrow:
 * **render only groups that returned rows, and use one empty state for every case.** A
 * user with access to one register and a user with access to four see an identical screen
 * when nothing matches.
 *
 * What that rules out, each of which is a disclosure rather than a kindness:
 *
 * - A group header per register, so "Vendors — no results" tells somebody vendors exist.
 * - "Searched 4 of 5 registers", or any count of what was consulted — a count is an
 *   inventory.
 * - A "some results are hidden from you" notice, which states it outright.
 * - Empty states that differ by register, which let a reader infer what exists by
 *   watching which message appears.
 *
 * And it has to hold **mid-keystroke**, not only at rest: the requirement is about what
 * this screen can ever show. Groups are derived from the rows actually returned, so a
 * term that briefly matches nothing cannot flicker a header in and out.
 *
 * ## What IS rendered, and why that is not a contradiction
 *
 * `truncated` and `unavailableSources` are both shown. Neither can name a register the
 * caller may not see — the backend omits those entirely — so the only thing either
 * discloses is something the reader is already entitled to search. Suppressing them
 * would be its own dishonesty: a capped result read as "everything", and a register that
 * threw read as a register with no matches.
 */
export default function DashboardSearch() {
  const router = useRouter();
  const listboxId = useId();

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term]);

  const longEnough = debounced.length >= SEARCH_MIN_TERM_LENGTH;

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => search(debounced),
    enabled: longEnough,
    // The term is in the key, so a superseded request's answer can never overwrite a
    // later one's — TanStack caches per key rather than racing a single slot.
    staleTime: 30_000,
  });

  /**
   * Grouped in `SEARCH_REGISTERS` order, **keeping only registers that returned rows**.
   *
   * This is where FR-005 is actually enforced in this app. Iterating the register list
   * and rendering a section per entry — the obvious way to write this — would emit a
   * header for every register whether or not the caller may see it.
   *
   * Ordering within a group is the server's and is left alone: it puts an exact code
   * match first and deliberately specifies nothing else, so a sort here would silently
   * defeat the one rule that exists.
   */
  const groups = useMemo(() => {
    const rows = results.data?.results ?? [];
    return SEARCH_REGISTERS.map((register) => ({
      register,
      rows: rows.filter((row) => row.register === register),
    })).filter((group) => group.rows.length > 0);
  }, [results.data]);

  /** The rows in render order, so arrow keys walk the list the reader sees. */
  const flat = useMemo(() => groups.flatMap((group) => group.rows), [groups]);

  /**
   * The highlighted row, clamped rather than reset in an effect.
   *
   * `active` is reset on each keystroke in `onChange`, but the result set also shrinks
   * *after* that — a longer term matches fewer rows — and an index left pointing past the
   * end would highlight nothing and make Enter do nothing. Clamping on render handles
   * both without a second state update chasing the first.
   */
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const activeRow = activeIndex >= 0 ? flat[activeIndex] : undefined;

  // Close on a click anywhere else. Without this the panel stays open over the page
  // after the reader has plainly moved on.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const go = (result: SearchResult) => {
    setOpen(false);
    setTerm('');
    setDebounced('');
    // `resultHref`, not `result.href`: the server's value is an API resource path and
    // sends every row to a 404 — see the note on `href` in `app/lib/api/search.ts`.
    router.push(resultHref(result));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Prevented so the caret does not jump to either end of the input while the
      // reader is walking the list.
      event.preventDefault();
      if (flat.length === 0) return;
      setOpen(true);
      setActive((current) => {
        const from = Math.min(current, flat.length - 1);
        return event.key === 'ArrowDown'
          ? (from + 1) % flat.length
          : (from - 1 + flat.length) % flat.length;
      });
      return;
    }
    if (event.key === 'Enter' && activeRow) {
      event.preventDefault();
      go(activeRow);
    }
  };

  /**
   * A 400 is the backend's too-short answer, not a failure.
   *
   * Its length bound is a validator, and both sides read the minimum from an environment
   * variable — so if the backend's is raised above this app's, a term this control
   * considers long enough is refused. Treating that as "keep typing" degrades correctly;
   * treating it as an error would tell the reader search is broken when it is working.
   */
  const tooShortPerServer =
    results.error instanceof ApiError && results.error.status === 400;

  const panelVisible = open && debounced.length > 0;

  const unavailable = (results.data?.unavailableSources ?? [])
    .map((register) =>
      SEARCH_COPY.registers[register as SearchRegister] ?? register,
    )
    .join(', ');

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <label htmlFor="dashboard-search" className="sr-only">
        {SEARCH_COPY.label}
      </label>
      <div className="relative">
        <input
          id="dashboard-search"
          type="search"
          role="combobox"
          aria-expanded={panelVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            panelVisible && activeRow ? `${listboxId}-${activeRow.id}` : undefined
          }
          autoComplete="off"
          value={term}
          placeholder={SEARCH_COPY.placeholder}
          onChange={(event) => {
            setTerm(event.target.value);
            // Reset here rather than in an effect on `debounced`: setState inside an
            // effect triggers a cascading render, and the highlight belongs to the
            // typing, not to the request the typing eventually causes.
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="block w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
      </div>

      {panelVisible && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {!longEnough || tooShortPerServer ? (
            <p className="px-3 py-2 text-sm text-gray-500" role="status">
              {SEARCH_COPY.keepTyping(SEARCH_MIN_TERM_LENGTH)}
            </p>
          ) : results.isPending ? (
            <p className="px-3 py-2 text-sm text-gray-500" role="status">
              {SEARCH_COPY.searching}
            </p>
          ) : results.isError ? (
            <p className="px-3 py-2 text-sm text-red-700" role="alert">
              {SEARCH_COPY.failed}
            </p>
          ) : (
            <>
              {/* One empty state, for every case. Never varied by register. */}
              {groups.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-500" role="status">
                  {SEARCH_COPY.empty}
                </p>
              )}

              <ul id={listboxId} role="listbox" aria-label={SEARCH_COPY.label}>
                {groups.map((group) => (
                  <li key={group.register} role="presentation">
                    <p className="border-b border-gray-100 bg-gray-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600">
                      {SEARCH_COPY.registers[group.register]}
                    </p>
                    <ul role="presentation">
                      {group.rows.map((row) => (
                        <li
                          key={row.id}
                          id={`${listboxId}-${row.id}`}
                          role="option"
                          aria-selected={activeRow?.id === row.id}
                          onPointerDown={(event) => {
                            // The input's blur would otherwise close the panel before
                            // the click landed.
                            event.preventDefault();
                            go(row);
                          }}
                          className={
                            activeRow?.id === row.id
                              ? 'cursor-pointer bg-blue-50 px-3 py-2'
                              : 'cursor-pointer px-3 py-2 hover:bg-gray-50'
                          }
                        >
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-gray-900">
                              {row.label}
                            </span>
                            <span className="font-mono text-xs text-gray-600">
                              {row.code}
                            </span>
                            {row.matchedOn === 'name' && (
                              <span className="text-xs text-gray-500">
                                {SEARCH_COPY.matchedOnName}
                              </span>
                            )}
                            {/* Said on the row, because landing on a list when you
                                picked a named record is otherwise just confusing. */}
                            {row.register === 'vendor' && (
                              <span className="text-xs text-gray-500">
                                {SEARCH_COPY.opensList}
                              </span>
                            )}
                          </span>
                          {/* FR-002's second half: the one fact that separates two
                              records sharing a name. */}
                          {row.sublabel && (
                            <span className="mt-0.5 block text-xs text-gray-500">
                              {row.sublabel}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              {results.data?.truncated && (
                <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
                  {SEARCH_COPY.truncated}
                </p>
              )}
              {unavailable && (
                <p
                  className="border-t border-gray-100 px-3 py-2 text-xs text-amber-800"
                  role="status"
                >
                  {SEARCH_COPY.unavailable(unavailable)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useLayer } from '@/app/lib/layers';
import { useDebounced } from '@/app/lib/use-url-state';
import type { SearchableOption } from '@/app/ui/searchable-select';
import { Spinner } from '@/app/ui/spinner';

export type { SearchableOption } from '@/app/ui/searchable-select';

/** One page of a server search. `total` is every match, not just this page. */
export interface AsyncSearchPage {
  items: SearchableOption[];
  total: number;
}

/**
 * A picker that searches the server as you type — for any list that can outgrow one page
 * (036 A11, A12).
 *
 * ## Why this exists
 *
 * Pickers loaded `pageSize: 100` or `200` — the server's maximum — and showed what came back. The
 * 101st employee, the 201st item, the 26th DWR **silently did not exist**: not greyed out, not
 * "and 40 more", simply absent, so a person searched for a worker they knew was on the rolls and
 * concluded the record was missing. Here nothing is loaded up front; each search asks the server,
 * the list says how many of how many it is showing, and "Load more" fetches the next page.
 *
 * ## The fetcher
 *
 *     search={(term, page) => listEmployees({ search: term, page, pageSize: 25, isActive: true })
 *       .then((r) => ({ items: r.data.map(toOption), total: r.total }))}
 *
 * `cacheKey` scopes React Query's cache (`['employees', companyId]`); answers are kept for the
 * session's normal 30 s, so reopening the picker is instant.
 *
 * ## The current value
 *
 * A form opened for an existing record has an id whose row may be on no page searched yet. Pass
 * `selectedOption` (from the record itself — it usually carries the name) and the box shows its
 * label; once something is chosen here, the chosen row is remembered for the same purpose.
 *
 * Keyboard and ARIA follow the same combobox pattern as `SearchableSelect` and the dashboard search.
 */
export default function AsyncSelect({
  value,
  onChange,
  search,
  cacheKey,
  selectedOption,
  emptyLabel,
  placeholder = 'Type to search',
  minChars = 0,
  debounceMs = 300,
  disabled = false,
  id,
  invalid = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  value: string;
  /** The chosen id, and its row (null for the empty choice). */
  onChange: (id: string, option: SearchableOption | null) => void;
  search: (term: string, page: number) => Promise<AsyncSearchPage>;
  /** What the results depend on besides the term — the entity and its scope. */
  cacheKey: readonly unknown[];
  /** The current value's row, for a value not on any page loaded yet. */
  selectedOption?: SearchableOption | null;
  /** Offered as the first row, selecting `''`. Omit to make a choice mandatory. */
  emptyLabel?: string;
  placeholder?: string;
  /** Characters to type before the server is asked. 0 lists the first page on open. */
  minChars?: number;
  debounceMs?: number;
  disabled?: boolean;
  /** For a `<label htmlFor>`. */
  id?: string;
  invalid?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const listboxId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<SearchableOption | null>(null);

  const debounced = useDebounced(term.trim(), debounceMs);
  const ready = debounced.length >= minChars;

  const results = useInfiniteQuery({
    queryKey: ['async-select', ...cacheKey, debounced],
    queryFn: ({ pageParam }) => search(debounced, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total && last.items.length > 0
        ? all.length + 1
        : undefined;
    },
    enabled: open && ready,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(
    () => results.data?.pages.flatMap((page) => page.items) ?? [],
    [results.data],
  );
  const total = results.data?.pages.at(-1)?.total ?? 0;

  // Before enough is typed only the empty choice is offered: there are no results to show yet.
  const rows = useMemo<SearchableOption[]>(() => {
    const empty = emptyLabel ? [{ id: '', label: emptyLabel }] : [];
    return ready ? [...empty, ...items] : empty;
  }, [emptyLabel, items, ready]);

  const selected =
    value === ''
      ? emptyLabel
        ? { id: '', label: emptyLabel }
        : null
      : (items.find((row) => row.id === value) ??
        (chosen?.id === value ? chosen : null) ??
        (selectedOption?.id === value ? selectedOption : null));

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Open, the list is a layer: Escape closes it, not the modal around the field (036 A8).
  useLayer(() => {
    setOpen(false);
    setTerm('');
  }, open);

  const choose = (row: SearchableOption) => {
    setChosen(row.id ? row : null);
    onChange(row.id, row.id ? row : null);
    setTerm('');
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (open) event.preventDefault();
      setOpen(false);
      setTerm('');
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (rows.length === 0) return;
      setActive((current) => {
        const from = Math.min(current, rows.length - 1);
        return event.key === 'ArrowDown'
          ? (from + 1) % rows.length
          : (from - 1 + rows.length) % rows.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      // Prevented while open: Enter on a highlighted row must not also submit the form.
      if (!open) return;
      event.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    }
  };

  const status = !ready
    ? `Type at least ${minChars} character${minChars === 1 ? '' : 's'} to search.`
    : results.isError
      ? errorMessage(results.error, 'Could not search. Please try again.')
      : results.isPending
        ? 'Searching…'
        : total === 0
          ? debounced
            ? `Nothing matches “${debounced}”.`
            : 'Nothing to choose from yet.'
          : items.length < total
            ? `Showing ${items.length} of ${total}. Type to narrow the list.`
            : `${total} ${total === 1 ? 'match' : 'matches'}.`;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && rows[active] ? `${listboxId}-${active}` : undefined
        }
        aria-label={ariaLabel}
        aria-describedby={
          [open ? statusId : null, ariaDescribedBy].filter(Boolean).join(' ') ||
          undefined
        }
        aria-invalid={invalid || undefined}
        aria-busy={(open && results.isFetching) || undefined}
        autoComplete="off"
        disabled={disabled}
        value={open ? term : (selected?.label ?? '')}
        placeholder={open ? placeholder : (emptyLabel ?? placeholder)}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className={clsx(
          'w-full rounded-md border px-3 py-2 pr-8 disabled:bg-gray-100',
          invalid ? 'border-red-400' : 'border-gray-300',
        )}
      />
      {open && results.isFetching && (
        <Spinner className="pointer-events-none absolute right-2.5 top-3 text-gray-400" />
      )}

      {!open && selected?.sublabel && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
          {selected.sublabel}
          {selected.note ? ` (${selected.note})` : ''}
        </p>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-72 overflow-y-auto"
          >
            {rows.map(
              (row, index) => (
                <li
                  key={row.id || '(none)'}
                  id={`${listboxId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={row.id === value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(row);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={clsx(
                    'cursor-pointer px-3 py-2 text-sm',
                    index === active && 'bg-brand-50',
                    row.id === value && 'font-medium',
                  )}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="shrink-0 tabular-nums">{row.label}</span>
                    {row.note && (
                      <span className="shrink-0 text-xs text-gray-500">
                        {row.note}
                      </span>
                    )}
                  </span>
                  {row.sublabel && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600">
                      {row.sublabel}
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
            <span
              id={statusId}
              role="status"
              className={clsx(results.isError && 'text-red-700')}
            >
              {status}
            </span>
            {ready && results.hasNextPage && (
              <button
                type="button"
                // Kept off the tab order's way: focus leaving the input would close the list.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void results.fetchNextPage()}
                disabled={results.isFetchingNextPage}
                className="shrink-0 rounded px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
              >
                {results.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

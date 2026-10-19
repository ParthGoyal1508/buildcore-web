'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TableSort } from '@/app/ui/table';

/**
 * `value`, once it has stopped changing for `ms` (036 A15).
 *
 * For a search box that feeds a query: fourteen list screens sent a request per keystroke, so
 * "cement" was six requests, answered in whatever order the network chose.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** How one value is written to, and read back from, the query string. */
export interface UrlCodec<T> {
  parse: (raw: string | null) => T;
  /** `null` removes the parameter — the default value never appears in the URL. */
  serialize: (value: T) => string | null;
}

export const urlString = (fallback = ''): UrlCodec<string> => ({
  parse: (raw) => raw ?? fallback,
  serialize: (value) => (value === fallback ? null : value),
});

export const urlNumber = (fallback: number): UrlCodec<number> => ({
  parse: (raw) => {
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  },
  serialize: (value) => (value === fallback ? null : String(value)),
});

export const urlBoolean = (fallback = false): UrlCodec<boolean> => ({
  parse: (raw) => (raw === null ? fallback : raw === 'true' || raw === '1'),
  serialize: (value) => (value === fallback ? null : String(value)),
});

/** One of a fixed set; anything else in the URL (a hand edit, an old link) reads as `fallback`. */
export const urlEnum = <T extends string>(
  values: readonly T[],
  fallback: T,
): UrlCodec<T> => ({
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : fallback),
  serialize: (value) => (value === fallback ? null : value),
});

/** A table sort as `key:asc` / `key:desc`, for `ResponsiveList`/`DataTable`'s server-sort mode. */
export const urlSort = (fallback: TableSort = null): UrlCodec<TableSort> => ({
  parse: (raw) => {
    const match = raw ? /^([\w.-]+):(asc|desc)$/.exec(raw) : null;
    return match ? { key: match[1], dir: match[2] as 'asc' | 'desc' } : fallback;
  },
  serialize: (value) => {
    if (!value) return fallback ? 'none' : null;
    if (fallback && value.key === fallback.key && value.dir === fallback.dir)
      return null;
    return `${value.key}:${value.dir}`;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, UrlCodec<any>>;
type ValuesOf<S extends Schema> = {
  [K in keyof S]: S[K] extends UrlCodec<infer T> ? T : never;
};

/**
 * A list screen's filters, search, page and sort, kept in the query string (036 A14).
 *
 * Twenty-two list screens held them in `useState`, so Back from a record returned to page 1 with
 * every filter cleared, and a filtered list could not be sent to anyone as a link. Here the URL is
 * the state: `router.replace` (no history entry per keystroke), defaults left out of the URL.
 *
 *     const [filters, setFilters, query] = useUrlState(
 *       { q: urlString(), status: urlEnum(STATUSES, 'all'), page: urlNumber(1), sort: urlSort() },
 *       { debounce: ['q'], resetPage: 'page' },
 *     );
 *     <input value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} />
 *     useQuery({ queryKey: ['vendors', query], queryFn: () => listVendors(query),
 *                placeholderData: keepPreviousData });
 *
 * - `filters` is what the controls show — a debounced key's latest keystroke included.
 * - `query` is what to fetch with: the URL's values, so a debounced key changes there only once
 *   typing pauses (`debounceMs`, 300 ms).
 * - `resetPage` names the page key to send back to its default whenever any other key changes —
 *   page 4 of the old filter is rarely a page of the new one.
 *
 * The page using this reads `useSearchParams`, so it must sit inside a `<Suspense>` boundary for a
 * prerendered route (see Next's `use-search-params` docs); the dashboard's client pages already do.
 */
export function useUrlState<S extends Schema>(
  schema: S,
  {
    debounce = [],
    debounceMs = 300,
    resetPage,
  }: {
    debounce?: (keyof S)[];
    debounceMs?: number;
    resetPage?: keyof S;
  } = {},
): [
  ValuesOf<S>,
  (patch: Partial<ValuesOf<S>>) => void,
  ValuesOf<S>,
] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The first render's schema: callers write it inline, and a new object each render must not
  // recompute everything.
  const [codecs] = useState(schema);
  const [drafts, setDrafts] = useState<Partial<ValuesOf<S>>>({});
  const [pending, setPending] = useState<ReadonlySet<keyof S>>(new Set());
  const timers = useRef(new Map<keyof S, number>());

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const raw = searchParams.toString();
  const query = useMemo(() => {
    const params = new URLSearchParams(raw);
    const out = {} as ValuesOf<S>;
    for (const key of Object.keys(codecs) as (keyof S)[]) {
      out[key] = codecs[key].parse(params.get(key as string));
    }
    return out;
  }, [codecs, raw]);

  // A draft wins while its write is pending, or once the URL has caught up with it; a draft the URL
  // has since moved away from (Back, a link) is ignored rather than shown over it.
  const values = useMemo(() => {
    const out = { ...query };
    for (const key of Object.keys(drafts) as (keyof S)[]) {
      const codec = codecs[key];
      const draft = drafts[key] as ValuesOf<S>[keyof S];
      if (
        pending.has(key) ||
        codec.serialize(draft) === codec.serialize(query[key])
      ) {
        out[key] = draft;
      }
    }
    return out;
  }, [codecs, query, drafts, pending]);

  const write = useCallback(
    (patch: Partial<ValuesOf<S>>) => {
      // From the live URL rather than the render's copy, so two quick writes do not undo each other.
      const params = new URLSearchParams(window.location.search);
      const keys = Object.keys(patch) as (keyof S)[];
      for (const key of keys) {
        const encoded = codecs[key].serialize(
          patch[key] as ValuesOf<S>[keyof S],
        );
        if (encoded === null) params.delete(key as string);
        else params.set(key as string, encoded);
      }
      if (resetPage !== undefined && keys.some((key) => key !== resetPage)) {
        params.delete(resetPage as string);
      }
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [codecs, pathname, resetPage, router],
  );

  const set = useCallback(
    (patch: Partial<ValuesOf<S>>) => {
      const now: Partial<ValuesOf<S>> = {};
      for (const key of Object.keys(patch) as (keyof S)[]) {
        if (!debounce.includes(key)) {
          now[key] = patch[key];
          continue;
        }
        const value = patch[key];
        setDrafts((current) => ({ ...current, [key]: value }));
        setPending((current) => new Set(current).add(key));
        window.clearTimeout(timers.current.get(key));
        timers.current.set(
          key,
          window.setTimeout(() => {
            timers.current.delete(key);
            write({ [key]: value } as Partial<ValuesOf<S>>);
            setPending((current) => {
              const next = new Set(current);
              next.delete(key);
              return next;
            });
          }, debounceMs),
        );
      }
      if (Object.keys(now).length > 0) write(now);
    },
    // `debounce` is a literal at every call site; its identity changing is not a reason to rebind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounceMs, write],
  );

  return [values, set, query];
}

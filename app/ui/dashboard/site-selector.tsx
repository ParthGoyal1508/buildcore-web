'use client';

import type { Site } from '@/app/lib/api/dashboard';
import AsyncSelect from '@/app/ui/async-select';

const PAGE = 25;

/**
 * The site selector for the Site Dashboard (spec FR-013).
 *
 * 036 E4: a searchable picker. A plain select of every site does not scale to a contractor with
 * forty sites, and its "Select a site…" first option jumped back to the first site when chosen —
 * there is no "no site" view on this page, so a choice is now mandatory. The sites list is already
 * loaded whole by the page; it is searched and paged here so nothing is cut off.
 */
export default function SiteSelector({
  sites,
  value,
  onChange,
  compact = false,
}: {
  sites: Site[];
  value: string;
  onChange: (siteId: string) => void;
  /**
   * Without its visible label, for the Site Dashboard's navy banner (2026-10-15), where the
   * banner's own title already says which site — a grey "Site" label on navy did not read.
   */
  compact?: boolean;
}) {
  const selected = sites.find((s) => s.id === value);
  return (
    <div className={compact ? 'w-full sm:w-64' : 'max-w-xs'}>
      <label
        htmlFor="site-dashboard-site"
        className={compact ? 'sr-only' : 'mb-1 block text-sm font-medium text-gray-700'}
      >
        Site
      </label>
      <AsyncSelect
        id="site-dashboard-site"
        value={value}
        onChange={(id) => {
          if (id) onChange(id);
        }}
        selectedOption={selected ? { id: selected.id, label: selected.name } : null}
        placeholder="Search sites"
        cacheKey={['site-dashboard', 'sites', 'picker', sites.length]}
        search={async (term, page) => {
          const matches = sites.filter((s) =>
            s.name.toLowerCase().includes(term.trim().toLowerCase()),
          );
          return {
            items: matches
              .slice((page - 1) * PAGE, page * PAGE)
              .map((s) => ({ id: s.id, label: s.name })),
            total: matches.length,
          };
        }}
      />
    </div>
  );
}

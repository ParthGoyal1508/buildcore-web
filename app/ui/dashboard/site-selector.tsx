'use client';

import type { Site } from '@/app/lib/api/dashboard';
import { SelectField, selectClass } from '@/app/ui/settings/form-fields';

/**
 * The site selector for the Site Dashboard (spec FR-013, FR-019 — native select).
 *
 * Built from the shared `SelectField` rather than its own label-and-select pair,
 * which is what it was: a bare content-width select whose right padding the native
 * chevron drew straight over. Capped rather than full-width because it is a single
 * control on a wide dashboard, not a column in a form.
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
  if (compact) {
    return (
      <div className="w-full sm:w-64">
        <label htmlFor="site-dashboard-site" className="sr-only">
          Site
        </label>
        <select
          id="site-dashboard-site"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          <option value="">Select a site…</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="max-w-xs">
      <SelectField
        id="site-dashboard-site"
        label="Site"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a site…</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

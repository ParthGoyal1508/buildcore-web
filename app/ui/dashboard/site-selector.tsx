'use client';

import type { Site } from '@/app/lib/api/dashboard';
import { SelectField } from '@/app/ui/settings/form-fields';

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
}: {
  sites: Site[];
  value: string;
  onChange: (siteId: string) => void;
}) {
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

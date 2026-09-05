'use client';

import type { Site } from '@/app/lib/api/dashboard';

/** The site selector for the Site Dashboard (spec FR-013, FR-019 — native select). */
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
    <label className="text-sm">
      <span className="mb-1 block text-gray-700">Site</span>
      <select
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a site…</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}

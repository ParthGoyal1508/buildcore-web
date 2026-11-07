'use client';

import { useMemo } from 'react';

import type { SiteOption } from '@/app/lib/api/hr-payroll';
import { LOCATION_ASSIGNMENT } from '@/app/lib/constants';

export interface ChosenPlaces {
  siteIds: string[];
  projectIds: string[];
}

export const NO_PLACES: ChosenPlaces = { siteIds: [], projectIds: [] };

export const placesChosen = (places: ChosenPlaces) =>
  places.siteIds.length + places.projectIds.length;

/**
 * The sites and whole projects a staff assignment covers (058).
 *
 * Two groups of checkboxes rather than one list, because they mean different things: a project
 * keeps up with its sites (a site added next month is covered), a site does not. The projects are
 * those of the company's sites, so a project with no site at all is not offered — there would be
 * nowhere to punch.
 */
export default function AssignmentPlaces({
  id,
  sites,
  value,
  onChange,
  disabled,
}: {
  id: string;
  sites: SiteOption[];
  value: ChosenPlaces;
  onChange: (next: ChosenPlaces) => void;
  disabled?: boolean;
}) {
  const projects = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; sites: number }>();
    for (const site of sites) {
      if (!site.projectId) continue;
      const entry = byId.get(site.projectId) ?? {
        id: site.projectId,
        name: site.projectName ?? site.projectId,
        sites: 0,
      };
      entry.sites += 1;
      byId.set(site.projectId, entry);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);

  const toggle = (key: keyof ChosenPlaces, itemId: string) => {
    const list = value[key];
    onChange({
      ...value,
      [key]: list.includes(itemId)
        ? list.filter((x) => x !== itemId)
        : [...list, itemId],
    });
  };

  const group = (
    title: string,
    key: keyof ChosenPlaces,
    items: { id: string; label: string }[],
  ) =>
    items.length > 0 && (
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </legend>
        {items.map((item) => (
          <label
            key={item.id}
            htmlFor={`${id}-${key}-${item.id}`}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <input
              id={`${id}-${key}-${item.id}`}
              type="checkbox"
              disabled={disabled}
              checked={value[key].includes(item.id)}
              onChange={() => toggle(key, item.id)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-accent-500"
            />
            {item.label}
          </label>
        ))}
      </fieldset>
    );

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-900">
          {LOCATION_ASSIGNMENT.placesLabel}
        </span>
        <span className="text-xs text-gray-500">
          {LOCATION_ASSIGNMENT.chosenCount(placesChosen(value))}
        </span>
      </div>
      <p className="text-xs text-gray-500">{LOCATION_ASSIGNMENT.placesHint}</p>
      <div
        className={`max-h-64 space-y-3 overflow-y-auto rounded-md border border-gray-200 p-3 ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        {sites.length === 0 ? (
          <p className="text-sm text-gray-500">{LOCATION_ASSIGNMENT.noPlaces}</p>
        ) : (
          <>
            {group(
              LOCATION_ASSIGNMENT.projectsGroup,
              'projectIds',
              projects.map((p) => ({
                id: p.id,
                label: LOCATION_ASSIGNMENT.projectOption(p.name, p.sites),
              })),
            )}
            {group(
              LOCATION_ASSIGNMENT.sitesGroup,
              'siteIds',
              sites.map((s) => ({ id: s.id, label: s.name })),
            )}
          </>
        )}
      </div>
    </div>
  );
}

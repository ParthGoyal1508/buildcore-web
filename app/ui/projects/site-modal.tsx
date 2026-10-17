'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  Site,
  SiteInput,
  createSite,
  getProjectDetail,
  updateSite,
} from '@/app/lib/api/projects';
import { MESSAGES, SITE_STATUSES, projectsLabel } from '@/app/lib/constants';
import { resolvePosition } from '@/app/lib/location';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { searchProjects } from '@/app/ui/projects/pickers';
import { useToast } from '@/app/ui/toast';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Add or edit a site (spec US2, FR-012).
 *
 * The geofence fields are required, not optional. They are `NOT NULL` columns
 * created by feature 003 and read on every punch to decide whether a worker was on
 * site — `data-model.md` lists them as nullable, but the migration that would have
 * made them so was never written, and widening them now would push a null check into
 * the busiest read in the system.
 */
/** The API's ceiling on a geofence radius (`site.dto.ts`, 036 I24). */
const MAX_GEOFENCE_METRES = 5000;

export default function SiteModal({
  site,
  onClose,
}: {
  site: Site | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(site?.name ?? '');
  const [projectId, setProjectId] = useState(site?.projectId ?? '');
  const [address, setAddress] = useState(site?.address ?? '');
  const [latitude, setLatitude] = useState(
    site ? String(site.latitude) : '',
  );
  const [longitude, setLongitude] = useState(
    site ? String(site.longitude) : '',
  );
  const [radius, setRadius] = useState(
    site ? String(site.geofenceRadiusMeters) : '',
  );
  const [weeklyOffDay, setWeeklyOffDay] = useState(
    site ? String(site.weeklyOffDay) : '0',
  );
  const [status, setStatus] = useState<string>(site?.status ?? 'active');

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const toast = useToast();
  // 036 I22: the project picker searches the server; it loaded the first 200 projects and the
  // 201st did not exist. The linked project is read by id so its name shows on an edit.
  const linkedProject = useQuery({
    queryKey: ['projects', 'detail', site?.projectId],
    queryFn: () => getProjectDetail(site!.projectId!),
    enabled: Boolean(site?.projectId),
    staleTime: 60_000,
  });

  const isDirty =
    name !== (site?.name ?? '') ||
    projectId !== (site?.projectId ?? '') ||
    address !== (site?.address ?? '') ||
    latitude !== (site ? String(site.latitude) : '') ||
    longitude !== (site ? String(site.longitude) : '') ||
    radius !== (site ? String(site.geofenceRadiusMeters) : '') ||
    weeklyOffDay !== (site ? String(site.weeklyOffDay) : '0') ||
    status !== (site?.status ?? 'active');

  // 036 I24: "Use my location" — coordinates were typed by hand, from a phone's map app, digit by
  // digit. Standing on the site and pressing this is the reliable way to set them.
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const fillFromDevice = async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      const position = await resolvePosition();
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
      setLocationNote(
        `Set from this device, accurate to about ${Math.round(position.coords.accuracy)} m.`,
      );
    } catch (error) {
      setLocationNote(
        error instanceof Error ? error.message : MESSAGES.locationUnavailable,
      );
    } finally {
      setLocating(false);
    }
  };

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint =
    latitude !== '' &&
    longitude !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const mutation = useMutation({
    mutationFn: () => {
      const payload: SiteInput = {
        name: name.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        geofenceRadiusMeters: Number(radius),
        weeklyOffDay: Number(weeklyOffDay),
        // Explicitly null, not undefined: clearing the project is a real edit, and
        // undefined would leave the existing link in place.
        projectId: projectId || null,
        address: address.trim(),
        status,
      };
      return site ? updateSite(site.id, payload) : createSite(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'sites'] });
      toast.success(site ? 'Site saved.' : 'Site added.');
      onClose();
    },
    onError: (error: unknown) =>
      setServerError(
        error instanceof ApiError ? error.message : MESSAGES.saveFailed,
      ),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const next: Record<string, string | undefined> = {};
    if (!name.trim()) next.name = 'Site name is required.';

    const lat = Number(latitude);
    if (latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      next.latitude = 'Latitude must be between -90 and 90.';
    }
    const lng = Number(longitude);
    if (longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      next.longitude = 'Longitude must be between -180 and 180.';
    }
    const metres = Number(radius);
    // 036 I24: the API caps the radius at 5,000 m (a typo of 5,000 km once made a geofence of
    // half a country, where every punch anywhere counted as on site).
    if (
      radius === '' ||
      !Number.isInteger(metres) ||
      metres < 1 ||
      metres > MAX_GEOFENCE_METRES
    ) {
      next.radius = `Geofence radius must be a whole number of metres, from 1 to 5,000.`;
    }

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    mutation.mutate();
  }

  return (
    <Modal
      title={site ? 'Edit site' : 'Add site'}
      onClose={onClose}
      isDirty={isDirty}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="site-form" loading={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="site-form" onSubmit={handleSubmit} className="space-y-4">
        <FormError message={serverError} />

        <TextField
          id="site-name"
          label="Site name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <div>
          <label
            htmlFor="site-project"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Project
          </label>
          <AsyncSelect
            id="site-project"
            value={projectId}
            onChange={(id) => setProjectId(id)}
            search={searchProjects}
            cacheKey={['projects', 'picker']}
            emptyLabel="Not linked to a project"
            selectedOption={
              linkedProject.data && linkedProject.data.project.id === projectId
                ? {
                    id: linkedProject.data.project.id,
                    label: linkedProject.data.project.name,
                    note: linkedProject.data.project.code,
                  }
                : null
            }
            placeholder="Type to search projects"
          />
        </div>
        <TextField
          id="site-address"
          label="Location address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          hint="Where to send a delivery. The coordinates below decide where a punch counts."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="site-latitude"
            label="Latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            error={errors.latitude}
            required
          />
          <TextField
            id="site-longitude"
            label="Longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            error={errors.longitude}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <SecondaryButton
              type="button"
              onClick={() => void fillFromDevice()}
              disabled={locating}
              className="min-h-[44px]"
            >
              {locating ? 'Finding your location…' : 'Use my location'}
            </SecondaryButton>
            {locationNote && (
              <span className="text-sm text-gray-600" role="status">
                {locationNote}
              </span>
            )}
          </div>
          {/* A small map of the point, so a swapped latitude and longitude — or a pin in the sea —
              is seen before Save. An OpenStreetMap embed: no new dependency and no API key. */}
          {hasPoint && (
            <div className="overflow-hidden rounded-md border border-gray-200">
              <iframe
                title="Map of the site's coordinates"
                className="h-40 w-full"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`}
              />
            </div>
          )}
        </div>

        <TextField
          id="site-radius"
          label="Geofence radius (metres)"
          type="number"
          min={1}
          max={MAX_GEOFENCE_METRES}
          step={1}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          error={errors.radius}
          hint={MESSAGES.geofenceHint}
          required
        />

        <SelectField
          id="site-weekly-off"
          label="Weekly off"
          value={weeklyOffDay}
          onChange={(e) => setWeeklyOffDay(e.target.value)}
        >
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
            (day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ),
          )}
        </SelectField>

        <SelectField
          id="site-status"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {SITE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectsLabel(value)}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}

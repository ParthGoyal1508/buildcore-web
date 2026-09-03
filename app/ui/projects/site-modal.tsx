'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  Site,
  SiteInput,
  createSite,
  getProjects,
  updateSite,
} from '@/app/lib/api/projects';
import { MESSAGES, SITE_STATUSES, projectsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
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

  // Enough for a picker without pagination. A company with more projects than this
  // needs a type-ahead, which is worth building when one exists rather than now.
  const { data: projects } = useQuery({
    queryKey: ['projects', 'portfolio', { pageSize: 200 }],
    queryFn: () => getProjects({ pageSize: 200 }),
  });

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
    if (radius === '' || !Number.isInteger(metres) || metres < 1) {
      next.radius = 'Geofence radius must be a whole number of metres, at least 1.';
    }

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    mutation.mutate();
  }

  return (
    <Modal
      title={site ? 'Edit site' : 'Add site'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="site-form" disabled={mutation.isPending}>
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
        <SelectField
          id="site-project"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Not linked to a project</option>
          {projects?.items.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} — {project.name}
            </option>
          ))}
        </SelectField>
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

        <TextField
          id="site-radius"
          label="Geofence radius (metres)"
          type="number"
          min={1}
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

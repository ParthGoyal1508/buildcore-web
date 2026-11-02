'use client';

import { CameraIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { blobToBase64 } from '@/app/lib/api/my-workspace';
import { TextButton } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';

/**
 * The evidence behind a punch or a refused attempt (057): where it was taken, and the photo.
 *
 * The photo is fetched only when somebody opens it. A refusal list is up to 200 rows, and loading a
 * face for every row on render would download every photo for a page somebody may only scan.
 */

/** A map pin for a GPS fix, opening Google Maps in a new tab. `—` where no fix was recorded. */
export function MapLink({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  if (latitude === null || longitude === null) {
    return <span className="text-gray-500">—</span>;
  }
  return (
    <a
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
      title={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
    >
      <MapPinIcon className="h-4 w-4" aria-hidden="true" />
      Map
    </a>
  );
}

/** "850 m" under a kilometre, "2.4 km" above; `—` for none. */
export function distanceLabel(meters: number | null): string {
  if (meters === null) return '—';
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function PhotoDialog({
  title,
  queryKey,
  load,
  onClose,
}: {
  title: string;
  queryKey: readonly unknown[];
  load: () => Promise<Blob>;
  onClose: () => void;
}) {
  const photo = useQuery({
    queryKey,
    // A data URL, not an object URL — the reason `company-logo.tsx` gives: an object URL must be
    // revoked by an effect, and React re-running that effect in development revoked the URL a
    // photo already in the cache was showing, so it opened once and was broken the second time.
    // A data URL has no lifecycle to get wrong; a refusal photo is ~40 KB.
    queryFn: async () => blobToBase64(await load()),
    staleTime: 10 * 60_000,
    // A 404 is the retention sweep, not a blip — asking again will not bring the photo back.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const url = photo.data ?? null;
  const gone = photo.error instanceof ApiError && photo.error.status === 404;

  return (
    <Modal title={title} onClose={onClose} closeOnBackdrop>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- an object URL, not an optimisable asset
        <img
          src={url}
          alt={title}
          className="mx-auto max-h-[70vh] w-auto rounded-md"
        />
      ) : photo.isPending ? (
        <p className="py-10 text-center text-sm text-gray-500" role="status">
          Loading photo…
        </p>
      ) : (
        <p className="py-10 text-center text-sm text-gray-600" role="alert">
          {gone
            ? 'This photo has been deleted under the retention policy. The record itself is kept.'
            : 'The photo could not be loaded. Try again.'}
        </p>
      )}
    </Modal>
  );
}

/**
 * "Photo" in a table cell, opening the image in a dialog. Says "Deleted" where the row reports no
 * photo held — the retention sweep removed it — so an empty cell is never mistaken for a fault.
 * `missing` replaces that wording where "no photo" has more than one cause (the daily register).
 */
export function EvidencePhoto({
  available,
  title,
  queryKey,
  load,
  missing = {
    label: 'Deleted',
    title: 'Deleted under the photo retention policy',
  },
}: {
  available: boolean;
  title: string;
  queryKey: readonly unknown[];
  load: () => Promise<Blob>;
  missing?: { label: string; title: string };
}) {
  const [open, setOpen] = useState(false);
  if (!available) {
    return (
      <span className="text-xs text-gray-500" title={missing.title}>
        {missing.label}
      </span>
    );
  }
  return (
    <>
      <TextButton type="button" onClick={() => setOpen(true)}>
        <CameraIcon className="h-4 w-4" aria-hidden="true" />
        Photo
      </TextButton>
      {open && (
        <PhotoDialog
          title={title}
          queryKey={queryKey}
          load={load}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

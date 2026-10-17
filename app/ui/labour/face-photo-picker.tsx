'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useState } from 'react';

import {
  LABOUR_ATTENDANCE_COPY,
  LABOUR_ENROLMENT_PHOTOS,
} from '@/app/lib/constants';
import CameraCapture from '@/app/ui/my/camera-capture';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Takes the 3–5 face photos a labour is registered with (031): a camera, thumbnails that can be
 * removed one at a time, and a counter. The camera closes itself at the fifth photo.
 */
export default function FacePhotoPicker({
  photos,
  onChange,
  error,
}: {
  photos: Blob[];
  onChange: (photos: Blob[]) => void;
  error?: string;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);

  // Object URLs for the thumbnails, revoked when the photos change or this unmounts.
  const thumbnails = useMemo(
    () => photos.map((p) => URL.createObjectURL(p)),
    [photos],
  );
  useEffect(
    () => () => thumbnails.forEach((url) => URL.revokeObjectURL(url)),
    [thumbnails],
  );

  return (
    <section aria-labelledby="face-photos" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 id="face-photos" className="text-sm font-medium text-gray-700">
          Face photos
        </h2>
        <span className="text-xs text-gray-500">
          {photos.length} of {LABOUR_ENROLMENT_PHOTOS.max} · at least{' '}
          {LABOUR_ENROLMENT_PHOTOS.min}
        </span>
      </div>
      <p className="text-xs text-gray-500">{LABOUR_ATTENDANCE_COPY.registerHelp}</p>

      {photos.length > 0 && (
        <ul className="grid grid-cols-5 gap-2">
          {thumbnails.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
              <img
                src={url}
                alt={`Face photo ${i + 1}`}
                className="aspect-square w-full rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white"
                aria-label={`Remove photo ${i + 1}`}
              >
                <XMarkIcon className="w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {cameraOpen ? (
        <CameraCapture
          captureLabel={`Take photo ${photos.length + 1}`}
          disabled={photos.length >= LABOUR_ENROLMENT_PHOTOS.max}
          onCancel={() => setCameraOpen(false)}
          onCapture={(blob) => {
            const next = [...photos, blob];
            onChange(next);
            if (next.length >= LABOUR_ENROLMENT_PHOTOS.max) setCameraOpen(false);
          }}
        />
      ) : (
        photos.length < LABOUR_ENROLMENT_PHOTOS.max && (
          <SecondaryButton
            type="button"
            className="w-full justify-center"
            onClick={() => setCameraOpen(true)}
          >
            {photos.length === 0 ? 'Open camera' : 'Take another photo'}
          </SecondaryButton>
        )
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

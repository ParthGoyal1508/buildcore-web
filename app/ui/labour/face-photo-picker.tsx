'use client';

import { useEffect, useMemo, useState } from 'react';

import type { LivenessCaptureResult } from '@/app/lib/api/liveness';
import { LABOUR_ATTENDANCE_COPY } from '@/app/lib/constants';
import LivenessCapture from '@/app/ui/attendance/liveness-capture';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * A labour's face, for registration or a retake (031; guided since 057).
 *
 * One liveness capture — the labour looks straight twice, then turns their head to each side as
 * the screen asks — in place of 3–5 separate photos. It proves a live person stood there, so a
 * labour cannot be registered from somebody's photo and then punched in by it every day; and the
 * slight turns give the template the angles a punch is taken at.
 */
export default function FacePhotoPicker({
  capture,
  onChange,
  error,
}: {
  capture: LivenessCaptureResult | null;
  onChange: (capture: LivenessCaptureResult | null) => void;
  error?: string;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);

  // The straight frame, previewed; revoked when the capture changes or this unmounts.
  const preview = useMemo(
    () => (capture ? URL.createObjectURL(capture.frames[0]) : null),
    [capture],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <section aria-labelledby="face-photos" className="space-y-2">
      <h2 id="face-photos" className="text-sm font-medium text-gray-700">
        Face
      </h2>
      <p className="text-xs text-gray-500">{LABOUR_ATTENDANCE_COPY.registerHelp}</p>

      {capture && preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
          <img
            src={preview}
            alt="Captured face"
            className="h-20 w-20 rounded-md object-cover"
          />
          <div className="space-y-2">
            <p className="text-sm text-gray-700">Face captured.</p>
            <SecondaryButton type="button" onClick={() => onChange(null)}>
              Retake
            </SecondaryButton>
          </div>
        </div>
      ) : cameraOpen ? (
        <LivenessCapture
          flow="labour-enrolment"
          subject="other"
          onCancel={() => setCameraOpen(false)}
          onCapture={(result) => {
            setCameraOpen(false);
            onChange(result);
          }}
        />
      ) : (
        <SecondaryButton
          type="button"
          className="w-full justify-center"
          onClick={() => setCameraOpen(true)}
        >
          Open camera
        </SecondaryButton>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CAMERA_FACING_STORAGE_KEY,
  CAPTURE_JPEG_QUALITY,
  CAPTURE_MAX_DIMENSION,
  DEFAULT_CAMERA_FACING,
  MESSAGES,
  type CameraFacing,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';

/**
 * Reads the remembered camera, falling back to the front one.
 *
 * Every access is wrapped: Safari in private mode *throws* on `localStorage` rather
 * than returning null, so an unguarded read would take the whole capture screen down
 * over a stored preference — the least important thing on it.
 */
function readStoredFacing(): CameraFacing {
  try {
    const stored = window.localStorage.getItem(CAMERA_FACING_STORAGE_KEY);
    return stored === 'environment' || stored === 'user'
      ? stored
      : DEFAULT_CAMERA_FACING;
  } catch {
    return DEFAULT_CAMERA_FACING;
  }
}

function storeFacing(facing: CameraFacing): void {
  try {
    window.localStorage.setItem(CAMERA_FACING_STORAGE_KEY, facing);
  } catch {
    // Preference not persisted; the toggle still works for this session, which is
    // the part that matters.
  }
}

/**
 * Live camera capture (research.md §3).
 *
 * One component for both enrolment (up to five shots in a session) and punch (one
 * shot), because the awkward parts — asking for permission, tearing the stream down
 * on unmount, telling a denied user something useful — are identical and are
 * exactly what gets forgotten when duplicated.
 *
 * A live `<video>` preview rather than `<input capture="user">`: the PRD asks for
 * in-page capture, and delegating to the OS camera app would turn a five-shot
 * enrolment into five separate round trips out of the browser and back.
 */
export default function CameraCapture({
  onCapture,
  captureLabel = 'Capture photo',
  disabled = false,
  onCancel,
}: {
  onCapture: (photo: Blob) => void;
  captureLabel?: string;
  disabled?: boolean;
  onCancel?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [isCapturing, setIsCapturing] = useState(false);
  // Safe to read storage in the initialiser: this component is only ever mounted
  // after a user gesture, so it never renders on the server and cannot produce a
  // hydration mismatch.
  const [facing, setFacing] = useState<CameraFacing>(readStoredFacing);
  // Whether to offer the toggle at all. Starts false so a single-camera device
  // never flashes a control it will not keep (T051).
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        setState('starting');
        const stream = await navigator.mediaDevices.getUserMedia({
          // `facingMode` as a plain value, not `{ exact: ... }`: an exact
          // constraint throws OverconstrainedError on a device that has no camera
          // facing that way, which would strand the user on an error screen. As a
          // preference, the browser picks the closest match instead.
          video: { facingMode: facing },
        });
        // The effect may have been torn down while the permission prompt was open;
        // adopting the stream now would leave the camera light on with nothing
        // rendering it.
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState('ready');

        // Enumerated only after the stream is live (T051). Before permission is
        // granted the browser returns a padded, unlabelled device list, so counting
        // it earlier would report a phantom second camera on single-camera devices
        // and hide the real one on some others.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (cancelled) return;
          setHasMultipleCameras(
            devices.filter((d) => d.kind === 'videoinput').length > 1,
          );
        } catch {
          // Enumeration is a progressive enhancement — without it the toggle stays
          // hidden, which is the safe default.
        }
      } catch (error) {
        if (cancelled) return;
        // `NotAllowedError` is a refusal the user can undo in their browser
        // settings; anything else means there is no usable camera at all, and the
        // two need different advice.
        setState(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'denied'
            : 'unavailable',
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      // Stopping the old tracks before the next acquisition is not optional:
      // leaving them live holds the camera open, and on several devices the
      // follow-up getUserMedia then fails outright. React runs this cleanup before
      // re-running the effect, so the ordering is guaranteed.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  const switchCamera = useCallback(() => {
    setFacing((current) => {
      const next: CameraFacing =
        current === 'user' ? 'environment' : 'user';
      storeFacing(next);
      return next;
    });
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || state !== 'ready') return;

    setIsCapturing(true);
    try {
      // Downscale to CAPTURE_MAX_DIMENSION on the longest edge before encoding.
      // Drawing the frame at full sensor resolution produces a payload the API
      // rejects outright with 413, and the server downscales further on arrival
      // regardless — so the extra pixels only ever cost bandwidth.
      const { videoWidth, videoHeight } = video;
      // `min(1, ...)` so a small frame is never upscaled: that would add bytes
      // without adding any detail.
      const scale = Math.min(
        1,
        CAPTURE_MAX_DIMENSION / Math.max(videoWidth, videoHeight),
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(videoWidth * scale);
      canvas.height = Math.round(videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) return;
      // Scaling down by more than half discards detail unevenly with the default
      // sampler; asking for high quality keeps a face recognisable to both the
      // matcher and a human reviewing an exception.
      context.imageSmoothingQuality = 'high';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', CAPTURE_JPEG_QUALITY),
      );
      if (blob) onCapture(blob);
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, state]);

  if (state === 'denied' || state === 'unavailable') {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-3" role="alert">
        <p className="text-sm text-amber-800">
          {state === 'denied'
            ? MESSAGES.cameraDenied
            : MESSAGES.cameraUnavailable}
        </p>
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel} className="mt-3">
            Close
          </SecondaryButton>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // Mirrored for the front camera only, so the preview behaves like a
          // mirror while someone frames themselves. The rear camera shows the world
          // rather than the viewer, and mirroring that would reverse reality —
          // text in frame would read backwards.
          className={
            facing === 'user' ? 'h-auto w-full -scale-x-100' : 'h-auto w-full'
          }
        />
      </div>

      {state === 'starting' && (
        <p className="text-sm text-gray-500" role="status">
          Starting camera…
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={capture}
          disabled={state !== 'ready' || disabled || isCapturing}
        >
          {captureLabel}
        </Button>
        {/* Rendered only when there is genuinely something to switch between: a
            disabled toggle on a single-camera device is worse than none, since it
            advertises a capability that does not exist (FR-015a). A real <button>
            with text, so it is keyboard-operable and announced rather than being an
            icon a screen reader cannot describe (FR-020). */}
        {hasMultipleCameras && (
          <SecondaryButton
            type="button"
            onClick={switchCamera}
            disabled={disabled || isCapturing}
          >
            {facing === 'user' ? 'Use rear camera' : 'Use front camera'}
          </SecondaryButton>
        )}
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel}>
            Cancel
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

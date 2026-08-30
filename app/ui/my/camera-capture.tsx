'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';

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

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || state !== 'ready') return;

    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
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
          // Mirrored, so the preview behaves like a mirror rather than reversing
          // every movement the person makes while framing themselves.
          className="h-auto w-full -scale-x-100"
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
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel}>
            Cancel
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

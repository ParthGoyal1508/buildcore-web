'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  issueLivenessChallenge,
  type LivenessCaptureResult,
  type LivenessFlow,
  type LivenessStep,
} from '@/app/lib/api/liveness';
import {
  CAMERA_FACING_STORAGE_KEY,
  DEFAULT_CAMERA_FACING,
  LIVENESS_COPY as COPY,
  LIVENESS_FRAME,
  MESSAGES,
  type CameraFacing,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';
type Phase =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'step'; index: number; steps: LivenessStep[]; secondsLeft: number }
  | { kind: 'done' };

function readStoredFacing(fallback: CameraFacing): CameraFacing {
  try {
    const stored = window.localStorage.getItem(CAMERA_FACING_STORAGE_KEY);
    return stored === 'environment' || stored === 'user' ? stored : fallback;
  } catch {
    return fallback;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One video frame, scaled to `maxDimension` on its longest edge, as a JPEG — unmirrored. */
async function grabFrame(
  video: HTMLVideoElement,
  maxDimension: number,
): Promise<Blob> {
  const { videoWidth, videoHeight } = video;
  const scale = Math.min(1, maxDimension / Math.max(videoWidth, videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(videoWidth * scale);
  canvas.height = Math.round(videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.imageSmoothingQuality = 'high';
  // Drawn from the raw stream, never the mirrored preview: the server reads the head turn from
  // the frame as the camera saw it.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', LIVENESS_FRAME.jpegQuality),
  );
  if (!blob) throw new Error('Could not encode the photo');
  return blob;
}

/**
 * The guided face capture every face photo follows (057): look straight, then turn the head to
 * each side in the order a one-time server challenge sets, each frame taken after a short
 * countdown. A photo held up to the camera cannot turn its head; a recording cannot know the order.
 *
 * `subject` words the prompts for who is in front of the camera — the person holding the phone
 * (`self`) or someone a supervisor is photographing (`other`). Arrows follow the preview: the front
 * camera is shown mirrored, so the person's left is the screen's left; the rear camera is not.
 *
 * The preview is capped at 480 px wide with an oval to fit the face in — a face that fills the oval
 * matches better and is seldom "not found" — and the camera is asked for 1280×720, so a labour a
 * couple of metres from a supervisor's phone still has a face worth matching.
 */
export default function LivenessCapture({
  flow,
  workerId,
  subject,
  onCapture,
  onCancel,
  disabled = false,
  defaultFacing = DEFAULT_CAMERA_FACING,
}: {
  flow: LivenessFlow;
  workerId?: string;
  subject: 'self' | 'other';
  onCapture: (capture: LivenessCaptureResult) => void;
  onCancel?: () => void;
  disabled?: boolean;
  defaultFacing?: CameraFacing;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [facing, setFacing] = useState<CameraFacing>(() =>
    readStoredFacing(defaultFacing),
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }
      try {
        setCamera('starting');
        const stream = await navigator.mediaDevices.getUserMedia({
          // Preferences, never `exact`: a device without that camera or size gets its closest.
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera('ready');
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setHasMultipleCameras(
              devices.filter((d) => d.kind === 'videoinput').length > 1,
            );
          }
        } catch {
          // Only decides whether the switch button shows.
        }
      } catch (err) {
        if (cancelled) return;
        setCamera(
          err instanceof DOMException && err.name === 'NotAllowedError'
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
  }, [facing]);

  // Set on every mount, not only initialised: React mounts, unmounts and remounts in development,
  // and a flag only ever set to true would leave a remounted capture believing it was cancelled.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const switchCamera = useCallback(() => {
    setFacing((current) => {
      const next: CameraFacing = current === 'user' ? 'environment' : 'user';
      try {
        window.localStorage.setItem(CAMERA_FACING_STORAGE_KEY, next);
      } catch {
        // Remembering the choice is a convenience.
      }
      return next;
    });
  }, []);

  const run = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setPhase({ kind: 'preparing' });
    let challenge;
    try {
      challenge = await issueLivenessChallenge(flow, workerId);
    } catch {
      setError(COPY.challengeFailed);
      setPhase({ kind: 'idle' });
      return;
    }
    const { steps } = challenge;
    const frames: Blob[] = [];
    try {
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        const seconds =
          step === 'straight'
            ? LIVENESS_FRAME.straightSeconds
            : LIVENESS_FRAME.turnSeconds;
        for (let left = seconds; left > 0; left -= 1) {
          if (cancelledRef.current) return;
          setPhase({ kind: 'step', index, steps, secondsLeft: left });
          await wait(1000);
        }
        if (cancelledRef.current) return;
        frames.push(
          await grabFrame(
            video,
            step === 'straight'
              ? LIVENESS_FRAME.straightMaxDimension
              : LIVENESS_FRAME.turnMaxDimension,
          ),
        );
      }
    } catch {
      setError(MESSAGES.cameraUnavailable);
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'done' });
    onCapture({ challengeId: challenge.challengeId, frames });
  }, [flow, workerId, onCapture]);

  if (camera === 'denied' || camera === 'unavailable') {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-3" role="alert">
        <p className="text-sm text-amber-800">
          {camera === 'denied'
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

  const mirrored = facing === 'user';
  const prompt = (() => {
    if (phase.kind !== 'step') return null;
    const step = phase.steps[phase.index];
    if (step === 'straight') return COPY.straight[subject];
    // Which way the head moves on screen: mirrored, the person's left is the screen's left.
    const onScreenLeft = mirrored ? step === 'left' : step === 'right';
    return COPY.turn[subject](step, onScreenLeft ? '←' : '→');
  })();
  const busy = phase.kind === 'preparing' || phase.kind === 'step';

  return (
    <div className="mx-auto w-full max-w-[480px] space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={mirrored ? 'h-auto w-full -scale-x-100' : 'h-auto w-full'}
        />
        {/* The oval to fit the face in. Decorative: the prompt below says the same in words. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-[3/4] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        />
        {phase.kind === 'step' && (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-center text-white">
            <p className="text-base font-semibold">{prompt}</p>
            <p className="text-3xl font-bold tabular-nums">
              {phase.secondsLeft}
            </p>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="text-sm text-gray-700">
        {camera === 'starting'
          ? 'Starting camera…'
          : phase.kind === 'preparing'
            ? COPY.starting
            : phase.kind === 'step'
              ? `${prompt} — ${phase.secondsLeft}`
              : phase.kind === 'done'
                ? COPY.done
                : COPY.intro[subject]}
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void run()}
          disabled={camera !== 'ready' || disabled || busy || phase.kind === 'done'}
          loading={phase.kind === 'preparing'}
        >
          {error ? COPY.retry : COPY.start}
        </Button>
        {hasMultipleCameras && (
          <SecondaryButton type="button" onClick={switchCamera} disabled={busy}>
            {facing === 'user' ? 'Use rear camera' : 'Use front camera'}
          </SecondaryButton>
        )}
        {onCancel && (
          <SecondaryButton type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

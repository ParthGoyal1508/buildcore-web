'use client';

import { CameraIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';

import { getCurrentUser } from '@/app/lib/api/users';
import { DEVICE_PERMISSION_COPY as COPY } from '@/app/lib/constants';
import {
  detectPlatform,
  PERMISSIONS_ONBOARDED_KEY,
  requestLocationAndCamera,
  usePermissionState,
  type DevicePermissionState,
  type PermissionRequestResult,
} from '@/app/lib/device-permissions';
import { Button, SecondaryButton } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';

/** For `useSyncExternalStore` reads of values that never change while the page is open. */
const subscribeNothing = () => () => undefined;

/** What went wrong, by the instruction it needs. */
export type PermissionProblem =
  'location-blocked' | 'camera-blocked' | 'location-off';

/**
 * The numbered steps for one problem on this device (057). Shown wherever a permission is the reason
 * a punch cannot go ahead — on the punch screens, and under a location error from the punch itself.
 */
export function PermissionSteps({
  problem,
  onRetry,
}: {
  problem: PermissionProblem;
  onRetry?: () => void;
}) {
  // Read on the client only: the server renders the desktop steps and the client swaps in its own
  // without a hydration mismatch.
  const platform = useSyncExternalStore(
    subscribeNothing,
    detectPlatform,
    () => 'desktop' as const,
  );
  const [title, steps] =
    problem === 'location-off'
      ? [COPY.locationOffTitle, COPY.steps.locationOff]
      : problem === 'location-blocked'
        ? [COPY.locationBlockedTitle, COPY.steps.location[platform]]
        : [COPY.cameraBlockedTitle, COPY.steps.camera[platform]];
  return (
    <div
      className="space-y-2 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-900"
      role="alert"
    >
      <p className="font-medium">{title}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="text-amber-800">{COPY.afterSteps}</p>
      {onRetry && (
        <SecondaryButton type="button" size="sm" onClick={onRetry}>
          {COPY.tryAgain}
        </SecondaryButton>
      )}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof CameraIcon;
  label: string;
  state: DevicePermissionState;
}) {
  const [text, tone] =
    state === 'granted'
      ? [COPY.stateGranted, 'bg-green-50 text-green-800 ring-green-600/20']
      : state === 'denied'
        ? [COPY.stateDenied, 'bg-red-50 text-red-800 ring-red-600/20']
        : [COPY.statePrompt, 'bg-gray-50 text-gray-700 ring-gray-500/20'];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}: {text}
    </span>
  );
}

/** Folds a request's outcome into the problem to explain, location first (the one users dismiss). */
function problemFrom(
  result: PermissionRequestResult,
): PermissionProblem | null {
  if (result.location === 'denied') return 'location-blocked';
  if (result.location === 'off') return 'location-off';
  if (result.camera === 'denied') return 'camera-blocked';
  return null;
}

/**
 * Camera and location status on a punch screen (057), with one button that asks for both.
 *
 * Renders nothing once both are allowed — a screen that works should not carry a banner saying so.
 * Where the browser cannot report a state (`unsupported`, older Safari for the camera) it is shown
 * as not yet allowed and the button stays; asking for something already granted costs one silent
 * call, which is cheaper than a worker finding out at the shutter.
 */
export function DevicePermissionsPanel() {
  const location = usePermissionState('geolocation');
  const camera = usePermissionState('camera');
  const [problem, setProblem] = useState<PermissionProblem | null>(null);
  const [asking, setAsking] = useState(false);

  if (location === 'granted' && camera === 'granted') return null;

  const ask = async () => {
    setAsking(true);
    try {
      setProblem(problemFrom(await requestLocationAndCamera()));
    } finally {
      setAsking(false);
    }
  };

  // A permission the browser reports as blocked will not prompt again; only the steps help.
  const shown: PermissionProblem | null =
    problem ??
    (location === 'denied'
      ? 'location-blocked'
      : camera === 'denied'
        ? 'camera-blocked'
        : null);

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <Chip icon={MapPinIcon} label={COPY.chipLocation} state={location} />
        <Chip icon={CameraIcon} label={COPY.chipCamera} state={camera} />
      </div>
      {shown ? (
        <PermissionSteps problem={shown} onRetry={() => void ask()} />
      ) : (
        <>
          <p className="text-sm text-gray-700">{COPY.needBoth}</p>
          <Button type="button" loading={asking} onClick={() => void ask()}>
            {COPY.allowButton}
          </Button>
        </>
      )}
    </section>
  );
}

/**
 * The first-open prompt (057): asks for camera and location once, on a tap, before anyone is
 * standing at a gate trying to punch.
 *
 * Shown once per device — answered or dismissed, it is remembered — and only while something is
 * still to be allowed. Browsers ignore a permission request that is not triggered by a tap, which
 * is why this is a dialog with a button rather than a request on page load. Mount it only where the
 * user marks attendance; the caller decides who that is.
 */
export function PermissionsOnboarding() {
  const location = usePermissionState('geolocation');
  const camera = usePermissionState('camera');
  const alreadyAnswered = useSyncExternalStore(
    subscribeNothing,
    () => window.localStorage.getItem(PERMISSIONS_ONBOARDED_KEY) === '1',
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<PermissionProblem | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    window.localStorage.setItem(PERMISSIONS_ONBOARDED_KEY, '1');
    setDismissed(true);
  };

  if (alreadyAnswered || dismissed) return null;
  if (!done && location === 'granted' && camera === 'granted') return null;

  // A permission the browser already reports as blocked will not prompt again, so the Allow button
  // would do nothing; its steps are the only useful thing to show.
  const shown: PermissionProblem | null =
    problem ??
    (location === 'denied'
      ? 'location-blocked'
      : camera === 'denied'
        ? 'camera-blocked'
        : null);

  const ask = async () => {
    setAsking(true);
    try {
      const found = problemFrom(await requestLocationAndCamera());
      setProblem(found);
      setDone(found === null);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal
      title={COPY.onboardingTitle}
      onClose={close}
      footer={
        done ? (
          <Button type="button" onClick={close}>
            OK
          </Button>
        ) : (
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={close}>
              {COPY.onboardingLater}
            </SecondaryButton>
            {!shown && (
              <Button type="button" loading={asking} onClick={() => void ask()}>
                {COPY.onboardingAllow}
              </Button>
            )}
          </div>
        )
      }
    >
      {done ? (
        <p className="text-sm text-gray-700">{COPY.allGranted}</p>
      ) : shown ? (
        <PermissionSteps problem={shown} onRetry={() => void ask()} />
      ) : (
        <div className="space-y-3 text-sm text-gray-700">
          <p>{COPY.onboardingBody}</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              icon={MapPinIcon}
              label={COPY.chipLocation}
              state={location}
            />
            <Chip icon={CameraIcon} label={COPY.chipCamera} state={camera} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * The first-open prompt on `/dashboard`, for whoever marks labour attendance (057). A supervisor's
 * home module is often the dashboard rather than `/labour`, so waiting for them to open the
 * attendance screen would ask at the gate — the moment this exists to avoid.
 */
export function SupervisorPermissionsOnboarding() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  if (!user?.permissions.includes('DAILY_WORKER_REGISTRY')) return null;
  return <PermissionsOnboarding />;
}

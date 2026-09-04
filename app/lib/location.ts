import { MAX_GPS_ACCURACY_METERS, MESSAGES } from '@/app/lib/constants';

/**
 * Shared GPS/geofence resolution (feature 013 FR-006).
 *
 * The two-attempt acquisition dance (high accuracy, then a coarse Wi-Fi/network
 * fallback) was written for `punch-clock.tsx` and is extracted here verbatim so the
 * supervisor muster wizard reuses the exact same implementation rather than growing a
 * second one. `punch-clock.tsx` now imports `resolvePosition`/`assertAccurate` from
 * here, so there is a single source of truth for how this app talks to
 * `navigator.geolocation`.
 *
 * The accuracy gate is deliberately separate from acquisition: the punch flow rejects
 * a fix too vague to place someone in a geofence (`assertAccurate`), while the muster
 * flow records the same fix and merely flags it (`isAccurateEnough`) — the
 * record-don't-reject rule the backend applies to labour attendance.
 */

/** One `getCurrentPosition` call, promisified so the two attempts can await. */
export function requestPosition(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options),
  );
}

/**
 * Resolves the device position without gating on accuracy: best fix first, then a
 * coarse fallback. Throws a user-facing message for a denied/insecure/timed-out fix
 * (a total absence of a fix, which both flows treat as blocking). The accuracy
 * decision is left to the caller.
 */
export async function resolvePosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error(MESSAGES.locationUnavailable);
  }
  if (!window.isSecureContext) {
    throw new Error(MESSAGES.locationInsecureConnection);
  }

  try {
    return await requestPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    });
  } catch (error) {
    const code = (error as GeolocationPositionError)?.code;
    if (code === 1 /* PERMISSION_DENIED */) {
      throw new Error(MESSAGES.locationDenied);
    }

    try {
      return await requestPosition({
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 60_000,
      });
    } catch (fallbackError) {
      const fallbackCode = (fallbackError as GeolocationPositionError)?.code;
      if (fallbackCode === 1) {
        throw new Error(MESSAGES.locationDenied);
      }
      throw new Error(
        fallbackCode === 3 /* TIMEOUT */
          ? MESSAGES.locationTimedOut
          : MESSAGES.locationUnavailable,
      );
    }
  }
}

/** Whether a fix is accurate enough to place someone inside a site geofence. */
export function isAccurateEnough(position: GeolocationPosition): boolean {
  return position.coords.accuracy <= MAX_GPS_ACCURACY_METERS;
}

/** Rejects a fix too vague to place someone inside a geofence — the punch flow's
 * gate, which throws rather than flagging. */
export function assertAccurate(
  position: GeolocationPosition,
): GeolocationPosition {
  if (!isAccurateEnough(position)) {
    throw new Error(MESSAGES.locationInaccurate(position.coords.accuracy));
  }
  return position;
}

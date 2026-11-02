'use client';

import { useEffect, useState } from 'react';

import { requestPosition } from '@/app/lib/location';

/**
 * Camera and location permission, read and requested in one place (057).
 *
 * A web app cannot open the phone's settings and a PWA manifest cannot declare permissions, so the
 * only levers are these: read the current state, ask while the user is tapping something, and, when
 * the browser has been told "never", explain where to change it. Everything that asks for either
 * permission goes through here so the punch screens and the first-open prompt agree on the state.
 */

/** `unsupported` where the browser cannot report the state (older Safari for camera): treat as unknown. */
export type DevicePermissionState =
  'granted' | 'prompt' | 'denied' | 'unsupported';

export type DevicePermission = 'geolocation' | 'camera';

/**
 * The live state of one permission. Subscribes to `change`, so granting it in the browser's own
 * settings updates the screen without a reload.
 */
export function usePermissionState(
  name: DevicePermission,
): DevicePermissionState {
  const [state, setState] = useState<DevicePermissionState>('unsupported');
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => {
      if (status && !cancelled) setState(status.state);
    };
    navigator.permissions
      // `camera` is missing from TypeScript's PermissionName union though Chrome and Safari 16+
      // accept it; Firefox throws, which lands in the catch as `unsupported`.
      ?.query({ name: name as PermissionName })
      .then((result) => {
        status = result;
        update();
        result.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', update);
    };
  }, [name]);
  return state;
}

export type PermissionRequestResult = {
  location: 'granted' | 'denied' | 'off';
  camera: 'granted' | 'denied' | 'unavailable';
};

/**
 * Asks for both, one after the other, from a tap. Location first: it is the prompt users are
 * likelier to dismiss without reading, and asking it while the camera is open would put two
 * prompts on screen at once on some Android builds.
 *
 * The camera stream is stopped the moment it is granted — this only asks; the capture screen opens
 * its own stream when a photo is actually taken.
 */
export async function requestLocationAndCamera(): Promise<PermissionRequestResult> {
  let location: PermissionRequestResult['location'] = 'granted';
  try {
    await requestPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    });
  } catch (error) {
    // Code 1 is a refusal of the permission; 2 and 3 mean it was granted but the phone's location
    // service is off or could not get a fix — a different instruction.
    location =
      (error as GeolocationPositionError)?.code === 1 ? 'denied' : 'off';
  }

  let camera: PermissionRequestResult['camera'] = 'granted';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    camera =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'denied'
        : 'unavailable';
  }
  return { location, camera };
}

/** Which instructions apply on this device. */
export type DevicePlatform =
  'android-app' | 'android-browser' | 'ios-app' | 'ios-browser' | 'desktop';

export function detectPlatform(): DevicePlatform {
  // `window`, not `navigator`: Node 21+ has a global `navigator`, so that guard let this run during
  // server rendering and throw on `window.matchMedia`.
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS's own flag for a home-screen web app.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return installed ? 'ios-app' : 'ios-browser';
  if (/Android/.test(ua)) return installed ? 'android-app' : 'android-browser';
  return 'desktop';
}

/** Where the one-time first-open prompt remembers it has been answered, per device. */
export const PERMISSIONS_ONBOARDED_KEY = 'tirupati.permissionsOnboarded';

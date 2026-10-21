'use client';

import { useSyncExternalStore } from 'react';

/** Chromium's install event; not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * The browser's install offer, held for whoever wants to use it (036).
 *
 * Chrome, Edge and Android fire `beforeinstallprompt` once, early, and only that event can open
 * the install dialog. The floating prompt used to keep it to itself, so once "Later" was pressed
 * there was no way to install short of the browser menu. Captured here on first import — the
 * floating prompt is mounted in the root layout, so that is before any page — and shared with
 * the Install App card in Settings.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Running as the installed app — standalone display, or iOS's home-screen flag. */
function runningInstalled(): boolean {
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Which instructions to show when there is no install event to fire. iPadOS reports itself as a
 * Mac, so a Mac with a touch screen is an iPad.
 */
function platformOf(): 'ios' | 'mac-safari' | 'other' {
  const ua = navigator.userAgent;
  if (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (/macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua)) {
    return 'mac-safari';
  }
  return 'other';
}

export type InstallState =
  | { kind: 'unknown' }
  | { kind: 'installed' }
  | { kind: 'promptable' }
  | { kind: 'manual'; platform: 'ios' | 'mac-safari' | 'other' };

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Snapshots must be stable between calls, so the state is read as a string key.
const snapshot = () =>
  runningInstalled() ? 'installed' : deferred ? 'promptable' : `manual:${platformOf()}`;

export function useInstallState(): InstallState {
  const key = useSyncExternalStore(subscribe, snapshot, () => 'unknown');
  if (key === 'unknown' || key === 'installed' || key === 'promptable') {
    return { kind: key };
  }
  return { kind: 'manual', platform: key.slice('manual:'.length) as 'ios' };
}

/**
 * Opens the browser's install dialog. The event works once; afterwards the browser may offer a
 * fresh one, which the listener above picks up.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

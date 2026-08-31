// The service worker runs in a worker global, not the DOM one the rest of this app
// is typed against — this pulls in `ServiceWorkerGlobalScope` for this file alone
// rather than widening `lib` project-wide, which would let worker-only globals
// type-check inside components that cannot use them.
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * App-shell caching for `/my/*` (research.md §5).
 *
 * `navigationPreload` is off: the point of this worker is that a site worker with
 * no signal can still open the Punch screen, and preload only helps when the
 * network is reachable.
 *
 * Nothing here touches `/my/punch` submissions. Caching a POST would be actively
 * harmful — a punch is a fact about a moment, and replaying a stale one later would
 * write attendance the worker never made. Queued punches live in IndexedDB and are
 * drained by the foreground `online` listener instead.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

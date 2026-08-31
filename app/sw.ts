// The service worker runs in a worker global, not the DOM one the rest of this app
// is typed against — this pulls in `ServiceWorkerGlobalScope` for this file alone
// rather than widening `lib` project-wide, which would let worker-only globals
// type-check inside components that cannot use them.
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

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

/**
 * API traffic is never cached, overriding `defaultCache`.
 *
 * `defaultCache` ends with a catch-all `!sameOrigin` NetworkFirst rule, and
 * `buildcore-api` is a different origin from this app — so without this every
 * `/my/*` GET (punch state, attendance, leave balances, salary slips, claims) was
 * being cached for up to an hour. Two problems, and the second is the serious one:
 *
 *   1. Stale reads. A screen could act on an answer the server had already moved
 *      past, which is how a completed punch-out kept offering "Punch Out".
 *   2. Leakage between people. The cache is scoped to the origin, not the session,
 *      and survives sign-out — so on a shared site phone one employee's attendance,
 *      payslip, or claim responses could be served to whoever signs in next. This
 *      data sits in the regulated tier (FR-026); that is not a trade worth making
 *      for offline convenience.
 *
 * Rules are matched in order, so placing this first shadows that catch-all. Fonts
 * are unaffected: `next/font/google` self-hosts Inter and Lusitana at build time,
 * making them same-origin `/_next/static` requests.
 *
 * The app shell stays precached, which is the offline behaviour this worker exists
 * for — an employee with no signal can still open the Punch screen; what they
 * cannot do is read data the network never confirmed.
 */
const runtimeCaching: RuntimeCaching[] = [
  { matcher: ({ sameOrigin }) => !sameOrigin, handler: new NetworkOnly() },
  ...defaultCache,
];
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
});

serwist.addEventListeners();

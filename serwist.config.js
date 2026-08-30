// @ts-check
import { serwist } from '@serwist/next/config';

/**
 * Service worker build (research.md §5).
 *
 * Configurator mode, not the classic `withSerwist` wrapper: Next.js 16 builds with
 * Turbopack by default, and the wrapper injects a webpack config that Turbopack
 * rejects. This runs as its own step after `next build` (see the build script),
 * which also means it can see the prerendered output and precache it.
 *
 * The worker's only job is caching the `/my/*` app shell so the Punch screen still
 * opens with no connectivity. Punch submission is deliberately not its concern —
 * queued punches live in IndexedDB and are drained by a foreground `online`
 * listener, because Background Sync is unsupported on iOS Safari and site workers'
 * phones include iPhones.
 */
export default serwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

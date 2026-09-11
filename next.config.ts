import type { NextConfig } from 'next';

/**
 * Where buildcore-api actually lives. Server-side only — no `NEXT_PUBLIC_` prefix, so
 * it never reaches the browser (015 FR-003).
 *
 * Read at BUILD time, not at run time. Next resolves `rewrites()` while building and
 * writes the destination into `.next/routes-manifest.json`, so setting this only as a
 * runtime variable leaves the proxy pointed at the default and every API call silently
 * goes somewhere else. It must be present in the build environment, and changing it
 * needs a rebuild rather than a restart.
 *
 * The throw below is what stops that shipping: an unset value in a production build is
 * a misconfiguration that would otherwise surface as "login works, nothing else does",
 * which is a bad afternoon.
 */
const API_ORIGIN =
  process.env.API_ORIGIN ??
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error(
          'API_ORIGIN must be set at build time. Next bakes rewrite destinations ' +
            'into the build, so a runtime-only value silently leaves the API proxy ' +
            'pointing at localhost.',
        );
      })()
    : 'http://localhost:3000');

const nextConfig: NextConfig = {
  /**
   * Proxy every backend call through this app's own origin (015 FR-003, FR-012).
   *
   * The browser used to talk to buildcore-api directly. Vercel and Render are different
   * registrable domains, so the refresh cookie was third-party data — which Safari
   * refuses by default and Chrome is withdrawing. Production records showed 83% of
   * sign-ins were never renewed even once: those sessions ended the moment the
   * 15-minute access token lapsed, and on every page reload. Reaching the browser from
   * this origin instead, a `Set-Cookie` carrying no `Domain` is stored first-party.
   *
   * A rewrite rather than a route handler at `app/bff/[...path]/route.ts`: the platform
   * streams the response body through untouched, which matters for a multi-megabyte
   * export — the obvious handler implementation buffers the whole file in memory — and
   * it forwards `Set-Cookie` without anyone writing header-copying code to get subtly
   * wrong. On Vercel it is handled by the edge, so there is no function invocation or
   * cold start per API call.
   *
   * `/bff`, not `/api`: `app/api/**` is where Next expects this app's own route
   * handlers, and a proxy mounted there would eventually collide with a real one.
   *
   * REQUIRES buildcore-api to be configured `REFRESH_COOKIE_PATH=/bff/auth`. Its cookie
   * defaults to `Path=/auth`, which is not a prefix of `/bff/auth`, so the browser would
   * store the credential and never send it back — a symptom indistinguishable from the
   * defect this replaces.
   */
  async rewrites() {
    return [{ source: '/bff/:path*', destination: `${API_ORIGIN}/:path*` }];
  },
};

// Serwist is deliberately NOT wrapped around this config. Next.js 16 builds with
// Turbopack by default, and `withSerwist` injects a webpack configuration that
// Turbopack refuses outright. The service worker is built instead by
// `serwist.config.js` as a separate step after `next build` (configurator mode),
// which is bundler-agnostic.
export default nextConfig;

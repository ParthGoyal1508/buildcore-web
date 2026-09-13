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
 * Validated rather than trusted. Every failure mode of this variable is silent — the
 * build succeeds, the app loads, sign-in appears to work, and only session renewal is
 * broken — so each one is turned into a build failure instead.
 */
function resolveApiOrigin(): string {
  const raw = process.env.API_ORIGIN?.trim();

  if (!raw) {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
    throw new Error(
      'API_ORIGIN must be set at build time. Next bakes rewrite destinations into ' +
        'the build, so a runtime-only value silently leaves the API proxy pointing ' +
        'at localhost.\n\n' +
        'Set it to the deployed API origin, e.g. https://your-api.onrender.com — ' +
        'the same value NEXT_PUBLIC_API_URL used to hold.\n\n' +
        'On Vercel: Settings -> Environment Variables. Enable it for EVERY ' +
        'environment you build, Preview included — a Production-only value fails ' +
        'every pull-request build with this same error.',
    );
  }

  // A missing scheme is the quiet one. Next treats a destination with no protocol as
  // a path rather than an external URL, so `/bff/x` would rewrite to something like
  // `/api.example.com/x` on this origin — a 404 per API call, with a build that
  // succeeded and a variable that looks right in the dashboard.
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `API_ORIGIN must be an absolute URL including the scheme; received "${raw}". ` +
        'Use https://your-api.onrender.com, not your-api.onrender.com — without a ' +
        'scheme Next treats the rewrite destination as a path on this origin and ' +
        'every API call 404s.',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `API_ORIGIN must use http or https; received "${parsed.protocol}".`,
    );
  }

  // Trailing slashes produce `https://host//:path*`. Stripped rather than rejected:
  // it is a harmless thing to type and there is no reason to fail a deploy over it.
  return raw.replace(/\/+$/, '');
}

const API_ORIGIN = resolveApiOrigin();

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

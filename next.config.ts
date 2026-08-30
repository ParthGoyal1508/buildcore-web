import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
};

// Serwist is deliberately NOT wrapped around this config. Next.js 16 builds with
// Turbopack by default, and `withSerwist` injects a webpack configuration that
// Turbopack refuses outright. The service worker is built instead by
// `serwist.config.js` as a separate step after `next build` (configurator mode),
// which is bundler-agnostic.
export default nextConfig;

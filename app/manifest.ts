import type { MetadataRoute } from 'next';
import { APP_NAME, APP_SHORT_NAME } from '@/app/lib/config';

// Served at /manifest.webmanifest. Generated rather than static so the develop
// deployment can carry its own name (see APP_NAME).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: 'Tirupati Groups — workforce, asset, and project management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#002d4e',
    orientation: 'portrait',
    scope: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

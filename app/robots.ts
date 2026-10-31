import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/app/lib/site-content';

/**
 * Search engines may index the public website and nothing else (053).
 *
 * Only on production: dev.tirupatigroups.in and the preview deployments carry test data and would
 * otherwise compete with the real site in search results.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/my', '/labour', '/inventory', '/home', '/login', '/bff'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

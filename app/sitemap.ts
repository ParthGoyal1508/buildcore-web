import type { MetadataRoute } from 'next';

import { NAV, SITE_URL } from '@/app/lib/site-content';

/** The website's pages (053) — the ERP behind `/login` is not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return NAV.map((item) => ({
    url: `${SITE_URL}${item.href === '/' ? '' : item.href}`,
    priority: item.href === '/' ? 1 : 0.8,
  }));
}

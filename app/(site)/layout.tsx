import type { Metadata } from 'next';

import { COMPANY, SITE_URL } from '@/app/lib/site-content';
import SiteFooter from '@/app/ui/site/site-footer';
import SiteHeader from '@/app/ui/site/site-header';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { template: `%s | ${COMPANY.name}`, default: COMPANY.name },
  openGraph: { type: 'website', siteName: COMPANY.name, locale: 'en_IN' },
  twitter: { card: 'summary_large_image' },
};

/** The public website (053) — its own header and footer, outside the ERP's shells. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

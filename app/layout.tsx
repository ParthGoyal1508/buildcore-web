import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import type { Metadata } from 'next';
import Providers from '@/app/providers';
import InstallPrompt from '@/app/install-prompt';

export const metadata: Metadata = {
  title: {
    template: '%s | BuildCore',
    default: 'BuildCore',
  },
  description: 'BuildCore ERP — construction workforce, assets, and project management.',
  manifest: '/manifest.webmanifest',
  applicationName: 'BuildCore',
  appleWebApp: {
    capable: true,
    title: 'BuildCore',
    statusBarStyle: 'default',
  },
  icons: [
    {
      rel: 'icon',
      url: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      rel: 'icon',
      url: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      rel: 'apple-touch-icon',
      url: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    },
  ],
  themeColor: '#0f172a',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before React
          hydrates — a false-positive mismatch, not a real one. Scoped to
          this one element only; doesn't suppress genuine hydration bugs
          anywhere else in the tree. */}
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
